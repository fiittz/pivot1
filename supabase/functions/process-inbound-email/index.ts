/**
 * Stage 1: Receive & Store inbound email from Resend webhook.
 *
 * Flow:
 *  1. Resend sends webhook on email.received event
 *  2. Parse the to-address to identify the client (inbound_email_code)
 *  3. Fetch full email + attachments from Resend API
 *  4. Store attachments in Supabase Storage
 *  5. Log to inbound_emails table
 *  6. Trigger Stage 2 (triage) via DB function / direct call
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const INBOUND_WEBHOOK_SECRET = Deno.env.get("INBOUND_WEBHOOK_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

/** Extract the inbound_email_code from the to-address. e.g. murphy-a7f3@in.balnce.ie → a7f3 */
function extractEmailCode(toAddress: string): string | null {
  // Format: {anything}-{code}@in.balnce.ie or {code}@in.balnce.ie
  const match = toAddress.match(/[-]([a-z0-9]{8})@in\.balnce\.ie/i);
  if (match) return match[1].toLowerCase();

  // Fallback: entire local part is the code
  const simpleMmatch = toAddress.match(/^([a-z0-9]{8})@in\.balnce\.ie/i);
  if (simpleMmatch) return simpleMmatch[1].toLowerCase();

  return null;
}

/** Fetch full email details from Resend API */
async function fetchResendEmail(emailId: string) {
  const resp = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!resp.ok) throw new Error(`Resend API error: ${resp.status}`);
  return resp.json();
}

/** Fetch attachments list from Resend API */
async function fetchResendAttachments(emailId: string): Promise<Array<{
  id: string;
  filename: string;
  content_type: string;
  size: number;
  download_url: string;
}>> {
  const resp = await fetch(`https://api.resend.com/emails/${emailId}/attachments`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!resp.ok) {
    console.error(`[InboundEmail] Failed to fetch attachments: ${resp.status}`);
    return [];
  }
  const data = await resp.json();
  return data.data ?? data ?? [];
}

/** Download an attachment and store in Supabase Storage */
async function storeAttachment(
  downloadUrl: string,
  storagePath: string,
  contentType: string,
): Promise<string | null> {
  try {
    const resp = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!resp.ok) return null;

    const blob = await resp.blob();
    const { error } = await supabase.storage
      .from("inbound-attachments")
      .upload(storagePath, blob, { contentType, upsert: true });

    if (error) {
      console.error(`[InboundEmail] Storage error:`, error);
      return null;
    }

    return storagePath;
  } catch (err) {
    console.error(`[InboundEmail] Download error:`, err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Resend webhook payload: { type: "email.received", data: { ... } }
    const event = body.type ?? body.event;
    if (event !== "email.received") {
      return new Response(JSON.stringify({ ignored: true, reason: "not email.received" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailData = body.data;
    const resendEmailId = emailData.id ?? emailData.email_id;
    const fromAddress = emailData.from ?? emailData.sender ?? "";
    const toAddresses: string[] = Array.isArray(emailData.to) ? emailData.to : [emailData.to ?? ""];
    const subject = emailData.subject ?? "";

    console.log(`[InboundEmail] Received from ${fromAddress} to ${toAddresses.join(", ")} — "${subject}"`);

    // Find the first to-address that matches our inbound domain
    let emailCode: string | null = null;
    let targetAddress = "";
    for (const addr of toAddresses) {
      const code = extractEmailCode(addr);
      if (code) {
        emailCode = code;
        targetAddress = addr;
        break;
      }
    }

    // Look up the client by inbound_email_code
    let accountantClient: Record<string, unknown> | null = null;
    if (emailCode) {
      const { data } = await supabase
        .from("accountant_clients")
        .select("id, client_user_id, practice_id, accountant_id, client_name")
        .eq("inbound_email_code", emailCode)
        .eq("status", "active")
        .maybeSingle();
      accountantClient = data;
    }

    // Fetch full email content from Resend
    let fullEmail: Record<string, unknown> = {};
    let bodyText = emailData.text ?? emailData.body ?? "";
    if (resendEmailId) {
      try {
        fullEmail = await fetchResendEmail(resendEmailId);
        bodyText = (fullEmail.text as string) ?? (fullEmail.body as string) ?? bodyText;
      } catch (err) {
        console.error("[InboundEmail] Could not fetch full email:", err);
      }
    }

    // Fetch and store attachments
    const attachmentPaths: string[] = [];
    let attachmentCount = 0;
    if (resendEmailId) {
      const attachments = await fetchResendAttachments(resendEmailId);
      attachmentCount = attachments.length;

      const clientFolder = accountantClient
        ? (accountantClient.client_user_id as string)
        : "unmatched";

      for (const att of attachments) {
        // Skip tiny files (likely email signatures) and very large files
        if (att.size < 100) continue;
        if (att.size > 10_000_000) {
          console.warn(`[InboundEmail] Skipping oversized attachment: ${att.filename} (${att.size} bytes)`);
          continue;
        }

        const path = `${clientFolder}/${resendEmailId}/${att.filename}`;
        const stored = await storeAttachment(att.download_url, path, att.content_type);
        if (stored) attachmentPaths.push(stored);
      }
    }

    // Log to inbound_emails table
    const status = accountantClient ? "pending" : "unmatched";
    const { data: emailRecord, error: insertError } = await supabase
      .from("inbound_emails")
      .insert({
        accountant_client_id: accountantClient?.id ?? null,
        client_user_id: accountantClient?.client_user_id ?? null,
        practice_id: accountantClient?.practice_id ?? null,
        from_address: fromAddress,
        to_address: targetAddress || toAddresses[0] || "",
        subject,
        body_text: bodyText.substring(0, 50_000), // Cap body at 50KB
        resend_email_id: resendEmailId,
        status,
        attachment_count: attachmentCount,
        attachment_paths: attachmentPaths,
      })
      .select("id")
      .single();

    if (insertError) {
      // Likely duplicate (resend_email_id unique constraint)
      if (insertError.code === "23505") {
        console.log("[InboundEmail] Duplicate email, skipping:", resendEmailId);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    console.log(`[InboundEmail] Stored email ${emailRecord.id} — status: ${status}, attachments: ${attachmentPaths.length}`);

    // If matched to a client, trigger Stage 2 (triage) asynchronously
    if (accountantClient && emailRecord) {
      // Call triage function (fire-and-forget via EdgeFunction invoke)
      supabase.functions.invoke("triage-email", {
        body: { inbound_email_id: emailRecord.id },
      }).catch((err: unknown) => console.error("[InboundEmail] Triage trigger failed:", err));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email_id: emailRecord.id,
        status,
        client: accountantClient?.client_name ?? null,
        attachments: attachmentPaths.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[InboundEmail] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error processing inbound email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
