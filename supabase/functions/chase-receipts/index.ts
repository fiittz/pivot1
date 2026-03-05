/**
 * Receipt Chaser — finds transactions without receipts and queues reminder emails.
 *
 * Designed to run on a schedule (pg_cron: daily at 9am).
 * Chase schedule: T+3 days, T+7 days, T+14 days (escalate to accountant).
 *
 * Only chases transactions:
 *   - Linked to an accountant (has accountant_client record)
 *   - Amount > €50 (configurable)
 *   - No receipt attached
 *   - Expense type
 *   - Not already chased at this level
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHASE_THRESHOLD_EUR = 50;
const CHASE_SCHEDULE = [
  { days: 3, chaseNumber: 1 },
  { days: 7, chaseNumber: 2 },
  { days: 14, chaseNumber: 3, escalate: true },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Math.abs(amount));
}

function buildChaseEmail(
  transactions: Array<{ description: string; amount: number; transaction_date: string }>,
  chaseNumber: number,
  clientName: string,
  inboundEmail: string | null,
): { subject: string; html: string } {
  const urgency = chaseNumber === 1 ? "Friendly reminder" : chaseNumber === 2 ? "Second reminder" : "Final reminder";
  const txnRows = transactions
    .map(
      (t) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${t.transaction_date}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee">${t.description}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(t.amount)}</td></tr>`,
    )
    .join("");

  const forwardInstructions = inboundEmail
    ? `<p style="margin-top:16px;padding:12px;background:#f0f9ff;border-radius:8px;font-size:14px">
         <strong>Easiest way:</strong> Forward the receipt email to <a href="mailto:${inboundEmail}">${inboundEmail}</a> and we'll handle the rest automatically.
       </p>`
    : "";

  return {
    subject: `${urgency}: ${transactions.length} receipt${transactions.length > 1 ? "s" : ""} needed`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#7c3aed;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Balnce</h1>
        </div>
        <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Hi ${clientName},</p>
          <p>We're missing receipt${transactions.length > 1 ? "s" : ""} for ${transactions.length > 1 ? "these transactions" : "this transaction"}:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:8px;text-align:left;font-size:12px;color:#6b7280">Date</th>
                <th style="padding:8px;text-align:left;font-size:12px;color:#6b7280">Description</th>
                <th style="padding:8px;text-align:right;font-size:12px;color:#6b7280">Amount</th>
              </tr>
            </thead>
            <tbody>${txnRows}</tbody>
          </table>
          ${forwardInstructions}
          <p style="margin-top:16px">
            <a href="${SITE_URL}/receipts" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px;font-weight:600">
              Upload Receipts
            </a>
          </p>
          ${chaseNumber >= 3 ? '<p style="color:#dc2626;font-size:13px;margin-top:16px">This is our final reminder. Your accountant has been notified about these missing receipts.</p>' : ""}
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">No receipt? Just reply to this email with "no receipt" and we'll note it.</p>
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
    const now = new Date();
    let totalChased = 0;
    let totalEscalated = 0;

    // Find all active accountant-client relationships
    const { data: clients } = await supabase
      .from("accountant_clients")
      .select("id, client_user_id, client_name, client_email, accountant_id, inbound_email_code, practice_id")
      .eq("status", "active")
      .not("client_user_id", "is", null);

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, chased: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const client of clients) {
      // Get transactions without receipts, above threshold, expense type
      const { data: transactions } = await supabase
        .from("transactions")
        .select("id, description, amount, transaction_date")
        .eq("user_id", client.client_user_id)
        .eq("type", "expense")
        .is("receipt_url", null)
        .lt("amount", -CHASE_THRESHOLD_EUR) // Expenses are negative
        .order("transaction_date", { ascending: false })
        .limit(100);

      if (!transactions || transactions.length === 0) continue;

      // For each chase level, find transactions that are old enough and haven't been chased at this level
      for (const schedule of CHASE_SCHEDULE) {
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - schedule.days);

        const eligibleTxns = [];
        for (const txn of transactions) {
          const txnDate = new Date(txn.transaction_date);
          if (txnDate > cutoffDate) continue; // Not old enough

          // Check if already chased at this level
          const { data: existingChase } = await supabase
            .from("receipt_chase_log")
            .select("id")
            .eq("transaction_id", txn.id)
            .eq("chase_number", schedule.chaseNumber)
            .limit(1);

          if (existingChase && existingChase.length > 0) continue;
          eligibleTxns.push(txn);
        }

        if (eligibleTxns.length === 0) continue;

        // Build the inbound email address for this client
        const inboundEmail = client.inbound_email_code
          ? `${client.client_name?.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")}-${client.inbound_email_code}@in.balnce.ie`
          : null;

        // Queue notification email to client
        const { subject, html } = buildChaseEmail(
          eligibleTxns.map((t) => ({
            description: t.description ?? "Unknown",
            amount: t.amount,
            transaction_date: t.transaction_date,
          })),
          schedule.chaseNumber,
          client.client_name || "there",
          inboundEmail,
        );

        const dedupKey = `receipt-chase:${client.client_user_id}:${schedule.chaseNumber}:${now.toISOString().split("T")[0]}`;

        const { data: notification } = await supabase
          .from("notification_queue")
          .insert({
            recipient_user_id: client.client_user_id,
            recipient_email: client.client_email,
            notification_type: "receipt_chase",
            subject,
            body_html: html,
            dedup_key: dedupKey,
            metadata: {
              chase_number: schedule.chaseNumber,
              transaction_count: eligibleTxns.length,
              accountant_client_id: client.id,
            },
          })
          .select("id")
          .maybeSingle();

        // Log each chase
        for (const txn of eligibleTxns) {
          await supabase.from("receipt_chase_log").insert({
            transaction_id: txn.id,
            client_user_id: client.client_user_id,
            accountant_client_id: client.id,
            chase_number: schedule.chaseNumber,
            notification_id: notification?.id ?? null,
            escalated_to_accountant: schedule.escalate ?? false,
          });
        }

        totalChased += eligibleTxns.length;

        // Escalate to accountant on final chase
        if (schedule.escalate) {
          // Get accountant's email
          const { data: accountant } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", client.accountant_id)
            .maybeSingle();

          if (accountant?.email) {
            await supabase.from("notification_queue").insert({
              recipient_user_id: client.accountant_id,
              recipient_email: accountant.email,
              notification_type: "receipt_chase",
              subject: `${client.client_name}: ${eligibleTxns.length} receipts still missing after 14 days`,
              body_html: `
                <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto">
                  <p><strong>${client.client_name}</strong> has ${eligibleTxns.length} transactions over ${formatCurrency(CHASE_THRESHOLD_EUR)} without receipts, dating back 14+ days.</p>
                  <p>We've sent 3 reminders. You may want to follow up directly.</p>
                  <p><a href="${SITE_URL}/accountant/clients/${client.client_user_id}">View client transactions</a></p>
                </div>
              `,
              dedup_key: `escalate:${client.id}:${now.toISOString().split("T")[0]}`,
              metadata: {
                client_name: client.client_name,
                transaction_count: eligibleTxns.length,
              },
            });
            totalEscalated++;
          }
        }
      }
    }

    console.log(`[ChaseReceipts] Chased ${totalChased} transactions, escalated ${totalEscalated} to accountants`);

    return new Response(
      JSON.stringify({ ok: true, chased: totalChased, escalated: totalEscalated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ChaseReceipts] Error:", error);
    return new Response(
      JSON.stringify({ error: "Receipt chasing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
