import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit: 10 invites per minute
    const rl = checkRateLimit(user.id, "client-invite", 10);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    const body = await req.json();
    const { client_name, client_email, client_business_name, client_phone, message } = body;

    if (!client_name || !client_email) {
      return new Response(
        JSON.stringify({ error: "client_name and client_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(client_email) || client_email.length > 254) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify the user is an accountant with a practice
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "accountant")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Only accountants can send client invitations" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: practice } = await supabase
      .from("accountant_practices")
      .select("id, name")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!practice) {
      return new Response(
        JSON.stringify({ error: "Please set up your practice before inviting clients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check for existing active client with this email
    const { data: existingClient } = await supabase
      .from("accountant_clients")
      .select("id, status")
      .eq("accountant_id", user.id)
      .eq("client_email", client_email.toLowerCase().trim())
      .in("status", ["pending_invite", "active"])
      .maybeSingle();

    if (existingClient) {
      return new Response(
        JSON.stringify({ error: "A client with this email already exists or has a pending invite" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create accountant_client record
    const { data: clientRecord, error: clientError } = await supabase
      .from("accountant_clients")
      .insert({
        practice_id: practice.id,
        accountant_id: user.id,
        client_name: client_name.trim(),
        client_email: client_email.toLowerCase().trim(),
        client_business_name: client_business_name?.trim() || null,
        client_phone: client_phone?.trim() || null,
        status: "pending_invite",
        access_level: "read_only",
      })
      .select()
      .single();

    if (clientError || !clientRecord) {
      console.error("Error creating client record:", clientError);
      return new Response(
        JSON.stringify({ error: "Failed to create client record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from("client_invitations")
      .insert({
        accountant_client_id: clientRecord.id,
        practice_id: practice.id,
        accountant_id: user.id,
        invite_email: client_email.toLowerCase().trim(),
        message: message?.trim() || null,
      })
      .select()
      .single();

    if (inviteError || !invitation) {
      console.error("Error creating invitation:", inviteError);
      return new Response(
        JSON.stringify({ error: "Failed to create invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send invitation email via Resend
    if (RESEND_API_KEY) {
      const acceptLink = `${SITE_URL}/invite/${invitation.invite_token}`;
      const personalMessage = message
        ? `<p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.6;background:#f9fafb;padding:16px;border-radius:8px;border-left:3px solid #E8930C;">"${message.trim()}"</p>`
        : "";

      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Balnce</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#F2C300;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#111;font-size:16px;line-height:1.6;">
                Hi ${client_name.trim()},
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
                <strong>${practice.name}</strong> has invited you to connect your Balnce account so they can manage your bookkeeping and tax filings.
              </p>
              ${personalMessage}
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${acceptLink}" style="display:inline-block;padding:14px 40px;background:#E8930C;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#333;font-size:15px;line-height:1.6;">
                This invitation expires in 30 days. If you don't have a Balnce account yet, you'll be able to create one when you accept.
              </p>
              <p style="margin:28px 0 0;color:#999;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${acceptLink}" style="color:#E8930C;word-break:break-all;">${acceptLink}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#999;font-size:12px;text-align:center;">
                Sent via <a href="https://balnce.ie" style="color:#F2C300;text-decoration:none;font-weight:600;">Balnce</a> &mdash; Accounting made simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Balnce <hello@balnce.ie>",
          to: [client_email.toLowerCase().trim()],
          subject: `${practice.name} has invited you to Balnce`,
          html: emailHtml,
        }),
      });

      if (!resendResponse.ok) {
        const resendError = await resendResponse.text();
        console.error("Resend API error:", resendResponse.status, resendError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured — invite email not sent");
    }

    return new Response(
      JSON.stringify({
        success: true,
        client: clientRecord,
        invitation: { id: invitation.id, invite_token: invitation.invite_token },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-client-invite:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
