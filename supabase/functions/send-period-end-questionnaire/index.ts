/**
 * Period-End Questionnaire — creates and sends questionnaires to clients
 * before their year-end or VAT period closes.
 *
 * Can be triggered:
 *   1. Automatically via pg_cron (checks all clients, sends if due)
 *   2. Manually by accountant (POST with specific accountant_client_id)
 *
 * Pre-fills answers from onboarding data where available.
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

// Send questionnaire X weeks before period end
const WEEKS_BEFORE_YEAR_END = 4;

function buildQuestionnaireEmail(
  clientName: string,
  periodEnd: string,
  questionnaireId: string,
): { subject: string; html: string } {
  return {
    subject: `Year-end questionnaire — action needed by ${periodEnd}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#7c3aed;padding:24px;border-radius:12px 12px 0 0">
          <h1 style="color:white;margin:0;font-size:20px">Balnce</h1>
        </div>
        <div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
          <p>Hi ${clientName},</p>
          <p>Your financial year-end is coming up on <strong>${periodEnd}</strong>.</p>
          <p>Your accountant needs a few things confirmed before they can prepare your filing. This takes about <strong>5 minutes</strong>.</p>

          <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:20px 0">
            <p style="margin:0 0 8px;font-weight:600">What you'll be asked:</p>
            <ul style="margin:0;padding-left:20px;color:#4b5563;font-size:14px">
              <li>Any new assets purchased over €1,000?</li>
              <li>Any new loans or finance agreements?</li>
              <li>Any staff changes?</li>
              <li>Personal card used for business expenses?</li>
              <li>Any income not through the bank account?</li>
              <li>Anything else your accountant should know?</li>
            </ul>
          </div>

          <p style="text-align:center;margin:24px 0">
            <a href="${SITE_URL}/questionnaire/${questionnaireId}"
               style="display:inline-block;padding:14px 32px;background:#7c3aed;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px">
              Complete Questionnaire
            </a>
          </p>

          <p style="color:#9ca3af;font-size:12px;margin-top:24px">
            If you have any questions, message your accountant directly in the Balnce app.
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
    const body = await req.json().catch(() => ({}));
    const specificClientId = body.accountant_client_id as string | undefined;
    const now = new Date();
    let created = 0;

    // Build query for clients to check
    let query = supabase
      .from("accountant_clients")
      .select("id, client_user_id, client_name, client_email, accountant_id, year_end_month, practice_id")
      .eq("status", "active")
      .not("client_user_id", "is", null)
      .not("year_end_month", "is", null);

    if (specificClientId) {
      query = query.eq("id", specificClientId);
    }

    const { data: clients } = await query;
    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, created: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    for (const client of clients) {
      const yearEndMonth = client.year_end_month as number; // 1-12

      // Calculate the next year-end date
      let yearEndYear = now.getFullYear();
      const yearEndDate = new Date(yearEndYear, yearEndMonth - 1 + 1, 0); // Last day of year_end_month
      if (yearEndDate < now) {
        yearEndYear++;
      }
      const periodEnd = new Date(yearEndYear, yearEndMonth - 1 + 1, 0);
      const periodStart = new Date(yearEndYear - 1, yearEndMonth, 1); // Start is month after prev year-end

      // Check if we're within the send window (X weeks before year-end)
      const sendDate = new Date(periodEnd);
      sendDate.setDate(sendDate.getDate() - WEEKS_BEFORE_YEAR_END * 7);

      if (!specificClientId && now < sendDate) continue; // Not yet time

      // Check if questionnaire already exists for this period
      const periodEndStr = periodEnd.toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("period_end_questionnaires")
        .select("id")
        .eq("accountant_client_id", client.id)
        .eq("period_type", "year_end")
        .eq("period_end", periodEndStr)
        .limit(1);

      if (existing && existing.length > 0) continue; // Already sent

      // Pre-fill from onboarding data
      const { data: onboarding } = await supabase
        .from("onboarding_settings")
        .select("*")
        .eq("user_id", client.client_user_id)
        .maybeSingle();

      const prefilled = {
        new_assets_over_1000: null,
        new_assets_details: null,
        new_loans_or_finance: null,
        new_loans_details: null,
        staff_changes: null,
        staff_changes_details: null,
        personal_card_business_expenses: null,
        personal_card_details: null,
        income_outside_bank: null,
        income_outside_details: null,
        other_notes: null,
        // Pre-fill context from onboarding
        _prefilled: {
          business_type: onboarding?.business_type ?? null,
          industry: onboarding?.industry ?? null,
          vat_registered: onboarding?.vat_registered ?? null,
          rct_registered: onboarding?.rct_registered ?? null,
          has_employees: onboarding?.has_employees ?? null,
        },
      };

      // Create questionnaire
      const { data: questionnaire, error: createError } = await supabase
        .from("period_end_questionnaires")
        .insert({
          accountant_client_id: client.id,
          client_user_id: client.client_user_id,
          accountant_id: client.accountant_id,
          period_type: "year_end",
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEndStr,
          status: "sent",
          sent_at: now.toISOString(),
          responses: prefilled,
        })
        .select("id")
        .single();

      if (createError) {
        console.error(`[PeriodEnd] Create error for ${client.client_name}:`, createError);
        continue;
      }

      // Queue email notification
      const { subject, html } = buildQuestionnaireEmail(
        client.client_name || "there",
        periodEndStr,
        questionnaire.id,
      );

      await supabase.from("notification_queue").insert({
        recipient_user_id: client.client_user_id,
        recipient_email: client.client_email,
        notification_type: "period_end_questionnaire",
        subject,
        body_html: html,
        dedup_key: `peq:${client.id}:${periodEndStr}`,
        metadata: {
          questionnaire_id: questionnaire.id,
          period_end: periodEndStr,
        },
      });

      created++;
      console.log(`[PeriodEnd] Created questionnaire for ${client.client_name} — period ending ${periodEndStr}`);
    }

    return new Response(
      JSON.stringify({ ok: true, created }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[PeriodEnd] Error:", error);
    return new Response(
      JSON.stringify({ error: "Period-end questionnaire failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
