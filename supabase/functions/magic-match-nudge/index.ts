/**
 * Magic Match Nudge — instant receipt prompt when new transactions are imported.
 *
 * Called after CSV import or future bank-feed webhook to:
 *   1. Check each new transaction for an existing receipt match (amount + supplier ±2 days)
 *   2. Auto-link matched receipts
 *   3. Queue a nudge email for unmatched expenses over €20
 *
 * Trigger: POST with { user_id, transaction_ids } or { user_id, since } (ISO timestamp)
 * Auth: Service role or authenticated user (owns the transactions)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NUDGE_THRESHOLD_EUR = 0; // Nudge for all expenses — Revenue can request any receipt
const MATCH_WINDOW_DAYS = 2;
const AMOUNT_TOLERANCE = 0.02; // 2 cent tolerance for receipt matching

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(Math.abs(amount));
}

function buildNudgeEmail(
  transactions: Array<{
    description: string;
    amount: number;
    transaction_date: string;
  }>,
  clientName: string,
  matchedCount: number,
  inboundEmail: string | null,
): { subject: string; html: string } {
  const txnRows = transactions
    .map(
      (t) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${t.transaction_date}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${t.description}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px;font-weight:600">${formatCurrency(t.amount)}</td>
        </tr>`,
    )
    .join("");

  const matchedNote =
    matchedCount > 0
      ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px">
           <p style="margin:0;font-size:14px;color:#166534">
             <strong>Magic Match:</strong> We automatically matched ${matchedCount} receipt${matchedCount > 1 ? "s" : ""} to your transactions.
           </p>
         </div>`
      : "";

  const forwardSection = inboundEmail
    ? `<div style="background:#f0f9ff;border-radius:8px;padding:14px 16px;margin-top:20px">
         <p style="font-size:13px;color:#1e40af;margin:0 0 4px">
           <strong>Easiest way:</strong> Forward the receipt email to:
         </p>
         <p style="font-family:monospace;font-size:14px;color:#1e40af;margin:0;font-weight:600">${inboundEmail}</p>
       </div>`
    : "";

  return {
    subject: `${transactions.length} new spend${transactions.length > 1 ? "s" : ""} — snap a receipt to stay compliant`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1a1a2e;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Balnce</h1>
          <p style="color:#a0a0b0;margin:4px 0 0;font-size:13px">New transactions detected</p>
        </div>
        <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p style="font-size:16px;margin:0 0 16px">Hi ${clientName},</p>

          ${matchedNote}

          <p style="font-size:14px;color:#6b7280;margin:0 0 12px">
            ${transactions.length > 0 ? `These ${transactions.length} transaction${transactions.length > 1 ? "s" : ""} still need a receipt:` : "All your new transactions have been matched!"}
          </p>

          ${transactions.length > 0
            ? `<table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
                <thead>
                  <tr style="background:#f9fafb">
                    <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Date</th>
                    <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Description</th>
                    <th style="padding:8px 12px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Amount</th>
                  </tr>
                </thead>
                <tbody>${txnRows}</tbody>
              </table>
              <p style="margin-top:20px">
                <a href="${SITE_URL}/receipts/bulk" style="display:inline-block;padding:12px 24px;background:#E8930C;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
                  Upload Receipts Now
                </a>
              </p>`
            : ""
          }

          ${forwardSection}

          <p style="color:#9ca3af;font-size:11px;margin-top:32px;border-top:1px solid #f0f0f0;padding-top:16px">
            Upload receipts within 48 hours for best bookkeeping accuracy.
            This is an automated notification from Balnce.
          </p>
        </div>
      </div>
    `,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, transaction_ids, since } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch new transactions — either by IDs or by timestamp
    let query = supabase
      .from("transactions")
      .select("id, description, amount, transaction_date, type, receipt_url")
      .eq("user_id", user_id)
      .eq("type", "expense")
      .order("transaction_date", { ascending: false });

    if (transaction_ids && transaction_ids.length > 0) {
      query = query.in("id", transaction_ids);
    } else if (since) {
      query = query.gte("created_at", since);
    } else {
      // Default: last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      query = query.gte("created_at", yesterday.toISOString());
    }

    const { data: transactions, error: txnError } = await query.limit(200);

    if (txnError) {
      console.error("[MagicMatch] Transaction query error:", txnError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch transactions" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, matched: 0, nudged: 0, skipped: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let matched = 0;
    let nudged = 0;
    let skipped = 0;
    const unmatchedForNudge: Array<{
      description: string;
      amount: number;
      transaction_date: string;
    }> = [];

    for (const txn of transactions) {
      // Skip if already has a receipt
      if (txn.receipt_url) {
        skipped++;
        continue;
      }

      // Skip small amounts
      if (Math.abs(txn.amount) < NUDGE_THRESHOLD_EUR) {
        skipped++;
        continue;
      }

      // Try to match against uploaded receipts (documents table)
      const txnDate = new Date(txn.transaction_date);
      const windowStart = new Date(txnDate);
      windowStart.setDate(windowStart.getDate() - MATCH_WINDOW_DAYS);
      const windowEnd = new Date(txnDate);
      windowEnd.setDate(windowEnd.getDate() + MATCH_WINDOW_DAYS);

      const { data: receipts } = await supabase
        .from("documents")
        .select("id, file_url, total_amount, document_date, supplier_name")
        .eq("user_id", user_id)
        .eq("document_type", "receipt")
        .is("matched_transaction_id", null) // Not yet matched
        .gte("document_date", windowStart.toISOString().split("T")[0])
        .lte("document_date", windowEnd.toISOString().split("T")[0]);

      let foundMatch = false;

      if (receipts && receipts.length > 0) {
        // Find a receipt that matches the amount
        const txnAmount = Math.abs(txn.amount);
        for (const receipt of receipts) {
          if (!receipt.total_amount) continue;
          const diff = Math.abs(receipt.total_amount - txnAmount);
          if (diff <= AMOUNT_TOLERANCE) {
            // Match found — link receipt to transaction
            await supabase
              .from("transactions")
              .update({
                receipt_url: receipt.file_url,
                notes: `${txn.description ? "" : ""}[Magic Match] Auto-matched receipt from ${receipt.supplier_name || "uploaded document"}`,
              })
              .eq("id", txn.id);

            await supabase
              .from("documents")
              .update({ matched_transaction_id: txn.id })
              .eq("id", receipt.id);

            matched++;
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        unmatchedForNudge.push({
          description: txn.description ?? "Unknown transaction",
          amount: txn.amount,
          transaction_date: txn.transaction_date,
        });
      }
    }

    // Send nudge email if there are unmatched transactions
    if (unmatchedForNudge.length > 0) {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, company_name")
        .eq("id", user_id)
        .maybeSingle();

      // Check for accountant link (for inbound email)
      const { data: accountantLink } = await supabase
        .from("accountant_clients")
        .select("inbound_email_code, client_name")
        .eq("client_user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const clientName =
        accountantLink?.client_name ||
        profile?.company_name ||
        "there";

      const inboundEmail = accountantLink?.inbound_email_code
        ? `${clientName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")}-${accountantLink.inbound_email_code}@in.balnce.ie`
        : null;

      if (profile?.email) {
        const { subject, html } = buildNudgeEmail(
          unmatchedForNudge,
          clientName,
          matched,
          inboundEmail,
        );

        const today = new Date().toISOString().split("T")[0];
        const dedupKey = `magic-nudge:${user_id}:${today}`;

        await supabase.from("notification_queue").insert({
          recipient_user_id: user_id,
          recipient_email: profile.email,
          notification_type: "receipt_nudge",
          subject,
          body_html: html,
          dedup_key: dedupKey,
          metadata: {
            matched_count: matched,
            unmatched_count: unmatchedForNudge.length,
            total_unmatched_amount: unmatchedForNudge.reduce(
              (sum, t) => sum + Math.abs(t.amount),
              0,
            ),
          },
        });

        nudged = unmatchedForNudge.length;
      }
    }

    console.log(
      `[MagicMatch] user=${user_id} matched=${matched} nudged=${nudged} skipped=${skipped}`,
    );

    return new Response(
      JSON.stringify({ ok: true, matched, nudged, skipped }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[MagicMatch] Error:", error);
    return new Response(
      JSON.stringify({ error: "Magic match failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
