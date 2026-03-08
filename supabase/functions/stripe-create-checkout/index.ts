import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

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
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth client - only used to verify the JWT
    const authClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: 20 checkout requests per minute per user
    const rl = checkRateLimit(user.id, "stripe-checkout", 20);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { invoiceId, origin } = body || {};

    if (!invoiceId || !origin) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: invoiceId, origin" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch invoice + customer
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*, customer:customers(name, email)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user owns this invoice
    if (invoice.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Invoice already paid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's Stripe connected account
    const { data: stripeAccount, error: stripeError } = await supabaseAdmin
      .from("stripe_accounts")
      .select("stripe_account_id, platform_fee_pct, charges_enabled")
      .eq("user_id", invoice.user_id)
      .single();

    if (stripeError || !stripeAccount) {
      return new Response(
        JSON.stringify({ error: "Stripe payments not set up" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stripeAccount.charges_enabled) {
      return new Response(
        JSON.stringify({ error: "Stripe account not fully activated. Complete onboarding first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const totalAmount = Number(invoice.total_amount || invoice.total || 0);
    const amount = Math.round(totalAmount * 100); // cents
    const platformFee = Math.round(amount * (Number(stripeAccount.platform_fee_pct) / 100));

    const invoiceNumber = invoice.invoice_number || "Invoice";
    const customerEmail = invoice.customer?.email || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Invoice ${invoiceNumber}`,
            description: `Payment for invoice ${invoiceNumber}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: platformFee,
        metadata: {
          invoice_id: invoiceId,
          user_id: invoice.user_id,
        },
      },
      customer_email: customerEmail,
      success_url: `${origin}/invoices/${invoiceId}?payment=success`,
      cancel_url: `${origin}/invoices/${invoiceId}?payment=cancelled`,
      metadata: {
        invoice_id: invoiceId,
        user_id: invoice.user_id,
      },
    }, {
      stripeAccount: stripeAccount.stripe_account_id,
    });

    // Update invoice with checkout session
    await supabaseAdmin.from("invoices").update({
      stripe_checkout_session_id: session.id,
      payment_link: session.url,
    }).eq("id", invoiceId);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in stripe-create-checkout:", error);
    return new Response(
      JSON.stringify({ error: "An internal error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
