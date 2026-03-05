/**
 * Weekly Bookkeeping Summary — sends a status email to business owners every Monday.
 *
 * Designed to run on a schedule (pg_cron: Monday 9am).
 * Shows: uncategorised transactions, missing receipts, unreconciled items,
 * questionnaire status, and the client's inbound email address.
 *
 * Only sends to clients linked to an accountant (has active accountant_client record).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Math.abs(amount));
}

interface ClientSummary {
  clientName: string;
  email: string;
  clientUserId: string;
  inboundEmail: string | null;
  totalTxns: number;
  uncategorised: number;
  missingReceipts: number;
  unreconciled: number;
  questionnaireStatus: string | null;
}

function buildSummaryEmail(summary: ClientSummary): { subject: string; html: string } {
  const allGood =
    summary.uncategorised === 0 &&
    summary.missingReceipts === 0 &&
    summary.unreconciled === 0;

  const items: string[] = [];

  if (summary.uncategorised > 0) {
    items.push(`
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
          <span style="font-size:24px;font-weight:700;color:#E8930C">${summary.uncategorised}</span>
          <span style="color:#6b7280;font-size:14px;margin-left:8px">transactions need categorising</span>
        </td>
      </tr>
    `);
  }

  if (summary.missingReceipts > 0) {
    items.push(`
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
          <span style="font-size:24px;font-weight:700;color:#E8930C">${summary.missingReceipts}</span>
          <span style="color:#6b7280;font-size:14px;margin-left:8px">receipts missing (expenses over €50)</span>
        </td>
      </tr>
    `);
  }

  if (summary.unreconciled > 0) {
    items.push(`
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
          <span style="font-size:24px;font-weight:700;color:#E8930C">${summary.unreconciled}</span>
          <span style="color:#6b7280;font-size:14px;margin-left:8px">transactions to reconcile</span>
        </td>
      </tr>
    `);
  }

  if (summary.questionnaireStatus && summary.questionnaireStatus !== "completed" && summary.questionnaireStatus !== "reviewed") {
    const qLabel =
      summary.questionnaireStatus === "sent"
        ? "Your accountant has sent you a period-end questionnaire — please complete it"
        : summary.questionnaireStatus === "started"
          ? "You've started your period-end questionnaire — don't forget to finish it"
          : null;

    if (qLabel) {
      items.push(`
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0">
            <span style="font-size:14px;color:#6b7280">📋 ${qLabel}</span>
          </td>
        </tr>
      `);
    }
  }

  const forwardSection = summary.inboundEmail
    ? `<div style="background:#f0f9ff;border-radius:8px;padding:16px;margin-top:24px">
         <p style="font-size:13px;color:#1e40af;margin:0 0 4px">
           <strong>Quick tip:</strong> Forward receipts to your Balnce email and we'll process them automatically:
         </p>
         <p style="font-family:monospace;font-size:14px;color:#1e40af;margin:0">
           ${summary.inboundEmail}
         </p>
       </div>`
    : "";

  const subject = allGood
    ? `${summary.clientName}: Your books are up to date ✓`
    : `${summary.clientName}: ${items.length} thing${items.length > 1 ? "s" : ""} to sort this week`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;padding:24px;border-radius:12px 12px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">Balnce</h1>
        <p style="color:#a0a0b0;margin:4px 0 0;font-size:13px">Weekly Bookkeeping Summary</p>
      </div>
      <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
        <p style="font-size:16px;margin:0 0 16px">Hi ${summary.clientName},</p>

        ${allGood
          ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center">
               <p style="font-size:28px;margin:0">✓</p>
               <p style="font-size:16px;font-weight:600;color:#166534;margin:8px 0 4px">You're all caught up!</p>
               <p style="font-size:13px;color:#4ade80;margin:0">Your bookkeeping is in great shape this week.</p>
             </div>`
          : `<p style="font-size:14px;color:#6b7280;margin:0 0 16px">Here's what needs attention this week:</p>
             <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
               ${items.join("")}
             </table>`
        }

        ${!allGood ? `
          <p style="margin-top:24px">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;padding:12px 24px;background:#E8930C;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
              Open Balnce
            </a>
          </p>
        ` : ""}

        ${forwardSection}

        <p style="color:#9ca3af;font-size:11px;margin-top:32px;border-top:1px solid #f0f0f0;padding-top:16px">
          ${summary.totalTxns} total transactions this period.
          This is an automated weekly summary from Balnce.
        </p>
      </div>
    </div>
  `;

  return { subject, html };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const year = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

    let totalSent = 0;

    // Find all active accountant-client relationships
    const { data: clients } = await supabase
      .from("accountant_clients")
      .select("id, client_user_id, client_name, client_email, inbound_email_code")
      .eq("status", "active")
      .not("client_user_id", "is", null)
      .not("client_email", "is", null);

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const client of clients) {
      // Total transactions
      const { count: totalTxns } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", client.client_user_id)
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd);

      if (!totalTxns || totalTxns === 0) continue; // No data, skip

      // Uncategorised
      const { count: uncategorised } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", client.client_user_id)
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd)
        .is("category_id", null);

      // Missing receipts (expenses > €50)
      const { count: missingReceipts } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", client.client_user_id)
        .eq("type", "expense")
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd)
        .lt("amount", -50)
        .is("receipt_url", null);

      // Unreconciled
      const { count: unreconciled } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", client.client_user_id)
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd)
        .or("is_reconciled.is.null,is_reconciled.eq.false");

      // Questionnaire status
      const { data: questionnaire } = await supabase
        .from("period_end_questionnaires")
        .select("status")
        .eq("client_user_id", client.client_user_id)
        .gte("period_end", periodStart)
        .lte("period_end", periodEnd)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Build inbound email address
      const inboundEmail = client.inbound_email_code
        ? `${(client.client_name || "client").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}-${client.inbound_email_code}@in.balnce.ie`
        : null;

      const summary: ClientSummary = {
        clientName: client.client_name || "there",
        email: client.client_email,
        clientUserId: client.client_user_id,
        inboundEmail,
        totalTxns: totalTxns ?? 0,
        uncategorised: uncategorised ?? 0,
        missingReceipts: missingReceipts ?? 0,
        unreconciled: unreconciled ?? 0,
        questionnaireStatus: questionnaire?.status ?? null,
      };

      const { subject, html } = buildSummaryEmail(summary);

      const dedupKey = `weekly-summary:${client.client_user_id}:${now.toISOString().split("T")[0]}`;

      await supabase.from("notification_queue").insert({
        recipient_user_id: client.client_user_id,
        recipient_email: client.client_email,
        notification_type: "general",
        subject,
        body_html: html,
        dedup_key: dedupKey,
        metadata: {
          type: "weekly_bookkeeping_summary",
          uncategorised: summary.uncategorised,
          missing_receipts: summary.missingReceipts,
          unreconciled: summary.unreconciled,
        },
      });

      totalSent++;
    }

    console.log(`[WeeklySummary] Queued ${totalSent} weekly summary emails`);

    return new Response(
      JSON.stringify({ ok: true, queued: totalSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[WeeklySummary] Error:", error);
    return new Response(
      JSON.stringify({ error: "Weekly summary failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
