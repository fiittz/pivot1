/**
 * Filing Deadline Check — runs daily via cron.
 *
 * Checks upcoming filing deadlines and:
 * 1. Creates finalization requests 90 days before deadline
 * 2. Sends reminder emails at 90, 60, 30 days
 * 3. Notifies accountant when client is unresponsive
 * 4. Assembles receipt coverage stats
 *
 * Trigger: Supabase cron or manual POST with CRON_SECRET
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Calculate receipt coverage for a user */
async function getReceiptCoverage(userId: string) {
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, description, amount, date, category, receipt_url, type")
    .eq("user_id", userId)
    .eq("type", "expense");

  if (!transactions) return { total: 0, matched: 0, unmatched: 0, uncategorised: 0, missing: [] };

  const matched = transactions.filter((t) => t.receipt_url);
  const unmatched = transactions.filter((t) => !t.receipt_url);
  const uncategorised = transactions.filter(
    (t) => !t.category || t.category === "Uncategorised",
  );

  const missing = unmatched.map((t) => ({
    transaction_id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
    category: t.category || "Uncategorised",
  }));

  return {
    total: transactions.length,
    matched: matched.length,
    unmatched: unmatched.length,
    uncategorised: uncategorised.length,
    missing,
  };
}

/** Send finalization email to client */
async function sendFinalizationEmail(
  userId: string,
  reportType: string,
  taxYear: number,
  daysUntilDue: number,
  isReminder: boolean,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();

  if (!profile?.email) return;

  const reportName = reportType === "ct1" ? "Corporation Tax (CT1)" : "Income Tax (Form 11)";
  const firstName = profile.full_name?.split(" ")[0] || "there";
  const questionnaireUrl = `${SITE_URL}/finalization?type=${reportType}&year=${taxYear}`;

  const subject = isReminder
    ? `Reminder: Complete your ${taxYear} ${reportName} questionnaire`
    : `Action needed: ${taxYear} ${reportName} — ${daysUntilDue} days until deadline`;

  const urgency =
    daysUntilDue <= 30
      ? "This is urgent — the deadline is less than a month away."
      : daysUntilDue <= 60
        ? "Please complete this soon to give your accountant enough time to review."
        : "There's plenty of time, but completing this early helps your accountant prepare.";

  await supabase.from("notification_queue").insert({
    user_id: userId,
    channel: "email",
    subject,
    body: JSON.stringify({
      template: "finalization_request",
      data: {
        firstName,
        reportName,
        taxYear,
        daysUntilDue,
        urgency,
        questionnaireUrl,
        isReminder,
      },
    }),
    dedup_key: `finalization-${reportType}-${taxYear}-${daysUntilDue <= 30 ? "urgent" : daysUntilDue <= 60 ? "second" : "first"}`,
  });
}

/** Notify accountant that client pack is ready or client is unresponsive */
async function notifyAccountant(
  clientUserId: string,
  reportType: string,
  taxYear: number,
  reason: "pack_ready" | "unresponsive",
) {
  // Find the accountant linked to this client
  const { data: link } = await supabase
    .from("accountant_clients")
    .select("accountant_id")
    .eq("client_user_id", clientUserId)
    .eq("status", "active")
    .maybeSingle();

  if (!link?.accountant_id) return;

  const { data: clientProfile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", clientUserId)
    .single();

  const { data: onboarding } = await supabase
    .from("onboarding_settings")
    .select("company_name")
    .eq("user_id", clientUserId)
    .single();

  const clientName = onboarding?.company_name || clientProfile?.full_name || clientProfile?.email || "Client";
  const reportName = reportType === "ct1" ? "CT1" : "Form 11";

  const subject =
    reason === "pack_ready"
      ? `${clientName} — ${reportName} ${taxYear} pack ready for review`
      : `${clientName} — ${reportName} ${taxYear} questionnaire not completed`;

  const body =
    reason === "pack_ready"
      ? `${clientName} has completed their ${reportName} finalization questionnaire. Their filing pack is ready for your review in Practice View.`
      : `${clientName} has not completed their ${reportName} ${taxYear} questionnaire despite multiple reminders. You may want to follow up directly.`;

  await supabase.from("notification_queue").insert({
    user_id: link.accountant_id,
    channel: "email",
    subject,
    body: JSON.stringify({
      template: "accountant_notification",
      data: { clientName, reportName, taxYear, reason, body },
    }),
    dedup_key: `accountant-${reason}-${clientUserId}-${reportType}-${taxYear}`,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization") ?? "";
    const secret = new URL(req.url).searchParams.get("secret");
    if (authHeader !== `Bearer ${CRON_SECRET}` && secret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get all deadlines in the next 90 days that haven't been fully processed
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const { data: deadlines } = await supabase
      .from("filing_deadlines")
      .select("*")
      .gte("due_date", today)
      .lte("due_date", cutoff.toISOString().split("T")[0]);

    if (!deadlines || deadlines.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No upcoming deadlines" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    let emailsSent = 0;

    for (const deadline of deadlines) {
      const dueDate = new Date(deadline.due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Only handle CT1 and Form 11 finalization (VAT is handled separately)
      if (deadline.report_type !== "ct1" && deadline.report_type !== "form11") continue;

      // Check if finalization request already exists
      const { data: existing } = await supabase
        .from("finalization_requests")
        .select("id, status")
        .eq("user_id", deadline.user_id)
        .eq("report_type", deadline.report_type)
        .eq("tax_year", deadline.tax_year)
        .maybeSingle();

      if (existing?.status === "completed") {
        // Already done — skip
        processed++;
        continue;
      }

      if (!existing) {
        // Create finalization request and send first email
        const coverage = await getReceiptCoverage(deadline.user_id);

        await supabase.from("finalization_requests").insert({
          user_id: deadline.user_id,
          report_type: deadline.report_type,
          tax_year: deadline.tax_year,
          status: "sent",
          receipt_coverage: {
            total: coverage.total,
            matched: coverage.matched,
            unmatched: coverage.unmatched,
            uncategorised: coverage.uncategorised,
          },
          missing_receipts: coverage.missing,
          sent_at: now.toISOString(),
        });

        await sendFinalizationEmail(
          deadline.user_id,
          deadline.report_type,
          deadline.tax_year,
          daysUntilDue,
          false,
        );

        await supabase
          .from("filing_deadlines")
          .update({ reminder_sent_at: now.toISOString() })
          .eq("id", deadline.id);

        emailsSent++;
      } else if (existing.status === "sent" || existing.status === "pending") {
        // Send reminders based on timeline
        if (daysUntilDue <= 30 && !deadline.urgent_reminder_at) {
          // Urgent reminder + notify accountant
          await sendFinalizationEmail(
            deadline.user_id,
            deadline.report_type,
            deadline.tax_year,
            daysUntilDue,
            true,
          );
          await notifyAccountant(deadline.user_id, deadline.report_type, deadline.tax_year, "unresponsive");
          await supabase
            .from("filing_deadlines")
            .update({ urgent_reminder_at: now.toISOString() })
            .eq("id", deadline.id);
          emailsSent++;
        } else if (daysUntilDue <= 60 && !deadline.second_reminder_at) {
          // Second reminder
          await sendFinalizationEmail(
            deadline.user_id,
            deadline.report_type,
            deadline.tax_year,
            daysUntilDue,
            true,
          );
          await supabase
            .from("filing_deadlines")
            .update({ second_reminder_at: now.toISOString() })
            .eq("id", deadline.id);
          emailsSent++;
        }
      }

      processed++;
    }

    console.log(`[FilingDeadlines] Processed ${processed} deadlines, sent ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ ok: true, processed, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[FilingDeadlines] Error:", error);
    return new Response(
      JSON.stringify({ error: `Filing deadline check failed: ${error.message || error}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
