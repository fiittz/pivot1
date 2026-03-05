/**
 * Stage 2: Triage — fast, cheap classification of inbound emails.
 *
 * Uses text-only model (no vision) to classify:
 *   invoice | receipt | credit_note | statement | bank_notice | personal | spam | newsletter | other
 *
 * Business documents proceed to Stage 3 (extract).
 * Everything else is marked 'ignored'.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const TRIAGE_MODEL = Deno.env.get("TRIAGE_MODEL") || "google/gemini-3-flash-preview";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUSINESS_DOCUMENT_TYPES = new Set(["invoice", "receipt", "credit_note", "statement"]);

const TRIAGE_SYSTEM_PROMPT = `You are an email classifier for an Irish accounting app.

Classify the email into exactly one of these categories:
- invoice: A supplier invoice or bill requesting payment
- receipt: A payment confirmation or purchase receipt
- credit_note: A credit note or refund notice from a supplier
- statement: A monthly/periodic account statement
- bank_notice: A bank notification (direct debit, standing order, balance alert)
- personal: Personal/non-business email
- spam: Unsolicited marketing, scams
- newsletter: Marketing newsletters, promotional offers, deals
- other: Anything that doesn't fit above

Consider:
- Forwarded invoices from suppliers are "invoice"
- Payment confirmations from Stripe, PayPal, card terminals are "receipt"
- "Your order has shipped" is NOT a receipt (no financial data)
- Bank alerts about transactions are "bank_notice"
- Supplier promotional emails are "newsletter" even if from a known vendor

Return ONLY valid JSON: { "classification": "...", "confidence": 0.0-1.0, "reason": "brief explanation" }`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { inbound_email_id } = await req.json();

    if (!inbound_email_id) {
      return new Response(
        JSON.stringify({ error: "inbound_email_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the email
    const { data: email, error } = await supabase
      .from("inbound_emails")
      .select("*")
      .eq("id", inbound_email_id)
      .single();

    if (error || !email) {
      return new Response(
        JSON.stringify({ error: "Email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Skip if already processed
    if (email.status !== "pending") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, status: email.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update status to triaging
    await supabase
      .from("inbound_emails")
      .update({ status: "triaging" })
      .eq("id", inbound_email_id);

    // Build triage input: subject + body text + attachment filenames
    const attachmentNames = (email.attachment_paths as string[] ?? [])
      .map((p: string) => p.split("/").pop())
      .join(", ");

    const triageInput = [
      `From: ${email.from_address}`,
      `Subject: ${email.subject || "(no subject)"}`,
      attachmentNames ? `Attachments: ${attachmentNames}` : "",
      `Body:\n${(email.body_text || "").substring(0, 3000)}`,
    ].filter(Boolean).join("\n");

    // Call AI for classification
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: TRIAGE_MODEL,
        messages: [
          { role: "system", content: TRIAGE_SYSTEM_PROMPT },
          { role: "user", content: triageInput },
        ],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[Triage] AI error:", aiResponse.status, errText);
      await supabase
        .from("inbound_emails")
        .update({ status: "failed" })
        .eq("id", inbound_email_id);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "{}";

    let classification: string;
    let confidence: number;
    try {
      const parsed = JSON.parse(content);
      classification = parsed.classification || "other";
      confidence = parsed.confidence ?? 0.5;
    } catch {
      console.error("[Triage] Failed to parse AI response:", content);
      classification = "other";
      confidence = 0.3;
    }

    console.log(`[Triage] Email ${inbound_email_id}: ${classification} (${(confidence * 100).toFixed(0)}%)`);

    // Route based on classification
    const isBusinessDoc = BUSINESS_DOCUMENT_TYPES.has(classification);
    const newStatus = isBusinessDoc ? "extracting" : "ignored";

    await supabase
      .from("inbound_emails")
      .update({
        triage_classification: classification,
        triage_confidence: Math.round(confidence * 100),
        status: newStatus,
      })
      .eq("id", inbound_email_id);

    // If business document, trigger Stage 3 (extract)
    if (isBusinessDoc) {
      supabase.functions.invoke("extract-document", {
        body: { inbound_email_id },
      }).catch((err: unknown) => console.error("[Triage] Extract trigger failed:", err));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email_id: inbound_email_id,
        classification,
        confidence,
        routed_to: isBusinessDoc ? "extract" : "ignored",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Triage] Error:", error);
    return new Response(
      JSON.stringify({ error: "Triage failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
