/**
 * Approve Client Report — accountant approves and sends a report to the client.
 *
 * POST { client_user_id, report_type, tax_year, period?, report_data, notes? }
 * Sets status to 'sent' and emails the client.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify accountant auth
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { client_user_id, report_type, tax_year, period, report_data, notes } = body;

    if (!client_user_id || !report_type || !tax_year || !report_data) {
      return new Response(
        JSON.stringify({ error: "client_user_id, report_type, tax_year, and report_data required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify accountant has access to this client
    const { data: link } = await supabase
      .from("accountant_clients")
      .select("id")
      .eq("accountant_id", user.id)
      .eq("client_user_id", client_user_id)
      .eq("status", "active")
      .maybeSingle();

    if (!link) {
      return new Response(
        JSON.stringify({ error: "You don't have access to this client" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();

    // Upsert the client report
    const { data: report, error: reportError } = await supabase
      .from("client_reports")
      .upsert(
        {
          accountant_id: user.id,
          client_user_id,
          report_type,
          tax_year,
          period: period || null,
          status: "sent",
          report_data,
          notes: notes || null,
          approved_at: now,
          sent_at: now,
        },
        { onConflict: "client_user_id,report_type,tax_year" },
      )
      .select()
      .single();

    if (reportError) {
      // If unique constraint doesn't exist, try insert
      const { data: inserted, error: insertError } = await supabase
        .from("client_reports")
        .insert({
          accountant_id: user.id,
          client_user_id,
          report_type,
          tax_year,
          period: period || null,
          status: "sent",
          report_data,
          notes: notes || null,
          approved_at: now,
          sent_at: now,
        })
        .select()
        .single();

      if (insertError) throw insertError;
    }

    // Get client info for email
    const { data: clientProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", client_user_id)
      .single();

    const { data: onboarding } = await supabase
      .from("onboarding_settings")
      .select("company_name")
      .eq("user_id", client_user_id)
      .single();

    const reportNames: Record<string, string> = {
      ct1: "Corporation Tax (CT1)",
      form11: "Income Tax (Form 11)",
      vat_return: "VAT Return",
      balance_sheet: "Balance Sheet",
    };
    const reportName = reportNames[report_type] || report_type;

    // Email the client
    if (clientProfile?.email) {
      const firstName = clientProfile.full_name?.split(" ")[0] || "there";
      const companyName = onboarding?.company_name || "your company";
      const reportUrl = `${SITE_URL}/tax?report=${report?.id || ""}`;

      const notesHtml = notes
        ? `<tr><td style="padding:20px 30px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#aaa;text-transform:uppercase;letter-spacing:0.5px;">Accountant Notes</p>
            <div style="background:#252547;border-left:3px solid #E8930C;padding:14px 18px;border-radius:4px;">
              <p style="margin:0;font-size:15px;color:#e0e0e0;line-height:1.6;">${notes}</p>
            </div>
          </td></tr>`
        : "";

      const bodyHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#121225;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121225;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:12px;overflow:hidden;">
  <tr><td style="padding:30px 30px 20px;text-align:center;border-bottom:1px solid #252547;">
    <span style="font-size:24px;font-weight:700;color:#E8930C;letter-spacing:1px;">balnce</span>
  </td></tr>
  <tr><td style="padding:30px 30px 10px;">
    <h1 style="margin:0 0 20px;font-size:22px;color:#ffffff;font-weight:600;">Report Approved</h1>
    <p style="margin:0 0 16px;font-size:16px;color:#e0e0e0;line-height:1.6;">Hi ${firstName},</p>
    <p style="margin:0;font-size:16px;color:#e0e0e0;line-height:1.6;">Your accountant has reviewed and approved your <strong style="color:#ffffff;">${tax_year} ${reportName}</strong> for <strong style="color:#ffffff;">${companyName}</strong>.</p>
  </td></tr>
  ${notesHtml}
  <tr><td style="padding:30px;text-align:center;">
    <a href="${reportUrl}" style="display:inline-block;background:#E8930C;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">View Report</a>
  </td></tr>
  <tr><td style="padding:20px 30px 30px;text-align:center;border-top:1px solid #252547;">
    <p style="margin:0;font-size:13px;color:#888;">Balnce &middot; Automated Bookkeeping for Irish Businesses</p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim();

      await supabase.from("notification_queue").insert({
        recipient_user_id: client_user_id,
        recipient_email: clientProfile.email,
        notification_type: "filing_approved",
        subject: `Your ${tax_year} ${reportName} is ready for review`,
        body_html: bodyHtml,
        dedup_key: `report-approved-${client_user_id}-${report_type}-${tax_year}`,
      });
    }

    // --- Auto Year-End Snapshot ---
    // When a CT1 or Form 11 filing is approved, auto-save a year-end snapshot
    // so closing balances carry forward as next year's opening balances.
    if (report_type === "ct1" || report_type === "form11") {
      try {
        const rd = report_data as Record<string, unknown>;
        const questionnaire = (rd.questionnaire_snapshot ?? rd.questionnaire ?? rd) as Record<string, unknown>;
        const computed = (rd.computed ?? {}) as Record<string, unknown>;
        const n = (obj: Record<string, unknown>, key: string): number => (obj[key] as number) ?? 0;

        const snapshotRow = {
          user_id: client_user_id,
          tax_year,
          source: "system",
          imported_by: user.id,

          // Fixed Assets (closing NBV)
          fixed_assets_land_buildings: n(questionnaire, "fixedAssetsLandBuildings"),
          fixed_assets_plant_machinery: n(questionnaire, "fixedAssetsPlantMachinery"),
          fixed_assets_motor_vehicles: n(computed, "motorVehicleNBV") || n(questionnaire, "fixedAssetsMotorVehicles"),
          fixed_assets_fixtures_fittings: n(questionnaire, "fixedAssetsFixturesFittings"),

          // Current Assets
          stock: n(questionnaire, "currentAssetsStock"),
          work_in_progress: n(questionnaire, "wipValue"),
          debtors: n(questionnaire, "currentAssetsDebtors") || n(questionnaire, "tradeDebtorsTotal"),
          prepayments: n(questionnaire, "prepaymentsAmount"),
          accrued_income: n(questionnaire, "accruedIncomeAmount"),
          cash: n(questionnaire, "currentAssetsCash"),
          bank_balance: n(questionnaire, "currentAssetsBankBalance"),
          rct_prepayment: n(computed, "rctPrepayment"),

          // Current Liabilities
          creditors: n(questionnaire, "liabilitiesCreditors") || n(questionnaire, "tradeCreditorsTotal"),
          accrued_expenses: n(questionnaire, "accrualsAmount"),
          deferred_income: n(questionnaire, "deferredIncomeAmount"),
          taxation: n(computed, "ctLiability"),
          bank_overdraft: 0,
          directors_loan_current: n(computed, "directorsLoanTravel"),
          vat_liability: 0,

          // Long-term Liabilities
          bank_loans: n(questionnaire, "liabilitiesBankLoans"),
          directors_loans: n(questionnaire, "liabilitiesDirectorsLoans") || n(questionnaire, "directorsLoanBalance"),

          // Capital & Reserves
          share_capital: n(questionnaire, "shareCapital") || 100,
          retained_profits: 0, // computed as balancing figure

          // P&L summary
          turnover: n(computed, "totalIncome"),
          total_expenses: n(computed, "totalExpenses"),
          net_profit: n(computed, "tradingProfit"),
          losses_forward: Math.max(0, -(n(computed, "tradingProfit"))),
          capital_allowances_claimed: n(computed, "capitalAllowancesTotal"),
        };

        const { error: snapError } = await supabase
          .from("year_end_snapshots")
          .upsert(snapshotRow, { onConflict: "user_id,tax_year" });

        if (snapError) {
          console.error("[ApproveReport] Snapshot save error (non-blocking):", snapError);
        } else {
          console.log(
            `[ApproveReport] Year-end snapshot saved for ${client_user_id} tax year ${tax_year}`,
          );
        }
      } catch (snapErr) {
        // Non-blocking — snapshot save should never fail the approval
        console.error("[ApproveReport] Snapshot save failed (non-blocking):", snapErr);
      }
    }

    console.log(
      `[ApproveReport] Accountant ${user.id} approved ${report_type} ${tax_year} for client ${client_user_id}`,
    );

    return new Response(
      JSON.stringify({ ok: true, report_id: report?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ApproveReport] Error:", error);
    return new Response(
      JSON.stringify({ error: `Failed to approve report: ${error.message || error}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
