import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

serve(async (req) => {
  // Webhooks are POST only — no CORS needed (Stripe calls this directly)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(
      `Webhook signature verification failed: ${(err as Error).message}`,
      { status: 400 }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        const userId = session.metadata?.user_id;

        if (!invoiceId || !userId) {
          console.warn("checkout.session.completed missing metadata:", { invoiceId, userId });
          break;
        }

        const amountTotal = (session.amount_total || 0) / 100;

        // Look up the actual platform fee from the stripe_accounts table
        const { data: stripeAccount } = await supabaseAdmin
          .from("stripe_accounts")
          .select("platform_fee_pct")
          .eq("user_id", userId)
          .single();

        const platformFeePct = Number(stripeAccount?.platform_fee_pct ?? 0.5);
        const platformFee = Math.round(amountTotal * (platformFeePct / 100) * 100) / 100;

        // 1. Record the payment
        const { data: payment } = await supabaseAdmin.from("stripe_payments").insert({
          user_id: userId,
          invoice_id: invoiceId,
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_checkout_session_id: session.id,
          amount: amountTotal,
          currency: session.currency || "eur",
          platform_fee: platformFee,
          status: "succeeded",
          payment_method_type: session.payment_method_types?.[0] || "card",
          customer_email: session.customer_email,
        }).select("id").single();

        // 2. Mark invoice as paid
        await supabaseAdmin.from("invoices").update({
          status: "paid",
          payment_method: "card",
          stripe_payment_intent_id: session.payment_intent as string,
          paid_at: new Date().toISOString(),
          paid_amount: amountTotal,
        }).eq("id", invoiceId);

        // 3. AUTO-CREATE TRANSACTION (automatic reconciliation)
        const { data: invoice } = await supabaseAdmin
          .from("invoices")
          .select("*, customer:customers(name)")
          .eq("id", invoiceId)
          .single();

        if (invoice) {
          // Find the "Sales" or "Revenue" category
          const { data: salesCategory } = await supabaseAdmin
            .from("categories")
            .select("id")
            .eq("user_id", userId)
            .ilike("name", "%sales%")
            .limit(1)
            .single();

          // Create the income transaction
          const { data: txn } = await supabaseAdmin.from("transactions").insert({
            user_id: userId,
            transaction_date: new Date().toISOString().split("T")[0],
            description: `Payment received: Invoice ${invoice.invoice_number} - ${invoice.customer?.name || "Customer"}`,
            amount: amountTotal,
            type: "income",
            category_id: salesCategory?.id || null,
            reference: `INV-${invoice.invoice_number}`,
            notes: `Auto-created from Stripe payment. Payment ID: ${session.payment_intent}`,
            is_reconciled: true,
            vat_amount: invoice.vat_amount || 0,
            vat_rate: invoice.vat_rate || 0,
          }).select("id").single();

          // Link transaction to payment record
          if (txn && payment) {
            await supabaseAdmin.from("stripe_payments").update({
              transaction_id: txn.id,
            }).eq("id", payment.id);
          }
        }

        console.log(`checkout.session.completed processed for invoice ${invoiceId}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoice_id;
        const userId = intent.metadata?.user_id;

        if (invoiceId && userId) {
          await supabaseAdmin.from("stripe_payments").insert({
            user_id: userId,
            invoice_id: invoiceId,
            stripe_payment_intent_id: intent.id,
            amount: intent.amount / 100,
            currency: intent.currency || "eur",
            status: "failed",
            metadata: { error: intent.last_payment_error?.message },
          });
          console.log(`payment_intent.payment_failed recorded for invoice ${invoiceId}`);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        await supabaseAdmin.from("stripe_accounts").update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          onboarding_complete: account.details_submitted,
          updated_at: new Date().toISOString(),
        }).eq("stripe_account_id", account.id);

        console.log(`account.updated processed for ${account.id}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (charge.payment_intent) {
          await supabaseAdmin.from("stripe_payments").update({
            status: "refunded",
          }).eq("stripe_payment_intent_id", charge.payment_intent as string);
          console.log(`charge.refunded processed for ${charge.payment_intent}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing webhook event ${event.type}:`, error);
    // Return 200 anyway to prevent Stripe from retrying (we logged the error)
    // In production, you might want to return 500 for transient errors
  }

  return new Response(
    JSON.stringify({ received: true }),
    { headers: { "Content-Type": "application/json" } }
  );
});
