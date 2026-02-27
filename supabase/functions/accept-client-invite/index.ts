import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function requires authentication — the client must be logged in
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { invite_token } = body;

    if (!invite_token) {
      return new Response(
        JSON.stringify({ error: "invite_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up invitation by token
    const { data: invitation, error: inviteError } = await supabase
      .from("client_invitations")
      .select("*, accountant_clients(*), accountant_practices(name)")
      .eq("invite_token", invite_token)
      .eq("status", "pending")
      .maybeSingle();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check expiration
    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("client_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);

      return new Response(
        JSON.stringify({ error: "This invitation has expired. Please ask your accountant to resend it." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the accepting user's email matches the invite email
    if (user.email?.toLowerCase() !== invitation.invite_email.toLowerCase()) {
      return new Response(
        JSON.stringify({
          error: "This invitation was sent to a different email address. Please sign in with the invited email.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Link the client: update accountant_clients with the client's user ID and activate
    const { error: linkError } = await supabase
      .from("accountant_clients")
      .update({
        client_user_id: user.id,
        status: "active",
      })
      .eq("id", invitation.accountant_client_id);

    if (linkError) {
      console.error("Error linking client:", linkError);
      return new Response(
        JSON.stringify({ error: "Failed to accept invitation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from("client_invitations")
      .update({ status: "accepted" })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("Error updating invitation status:", updateError);
    }

    const practiceName = invitation.accountant_practices?.name || "Your accountant";

    return new Response(
      JSON.stringify({
        success: true,
        message: `You are now connected to ${practiceName}`,
        practice_name: practiceName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in accept-client-invite:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
