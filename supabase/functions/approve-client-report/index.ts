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
      await supabase.from("notification_queue").insert({
        user_id: client_user_id,
        channel: "email",
        subject: `Your ${tax_year} ${reportName} is ready for review`,
        body: JSON.stringify({
          template: "report_approved",
          data: {
            firstName,
            reportName,
            taxYear: tax_year,
            companyName: onboarding?.company_name,
            notes,
            reportUrl: `${SITE_URL}/tax?report=${report?.id || ""}`,
          },
        }),
        dedup_key: `report-approved-${client_user_id}-${report_type}-${tax_year}`,
      });
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
