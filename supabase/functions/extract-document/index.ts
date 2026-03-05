/**
 * Stage 3: Extract — uses vision model to OCR/extract structured data from
 * invoice/receipt attachments and email bodies.
 *
 * Handles: PDF, images (JPEG/PNG), HTML email bodies.
 * Outputs structured invoice/receipt data (supplier, amounts, VAT, line items).
 * Then triggers Stage 4 (enrich-and-route).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const AI_MODEL = Deno.env.get("AI_MODEL") || "google/gemini-3-flash-preview";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_SYSTEM_PROMPT = `You are an expert Irish accounting document extraction AI for Balnce.
Extract structured financial data from invoices, receipts, credit notes, and statements.

IRISH VAT RATES:
- 23% Standard: General goods & services
- 13.5% Reduced: Construction, energy, repairs, cleaning
- 9% Hospitality: Restaurants, hotels, catering
- 0% Zero-rated: Exports, certain food, children's clothing
- Exempt: Medical, education, financial services

EXTRACTION RULES:
- Extract ALL visible amounts, dates, and reference numbers
- For invoices: capture payment terms and due date
- For receipts: capture payment method
- Read EVERY line item description exactly as printed
- If VAT is shown separately, extract both net and gross
- If VAT number is visible, extract it (important for Irish compliance)
- For credit notes: amounts should be negative
- Currency defaults to EUR unless stated otherwise

Return ONLY valid JSON matching this schema:
{
  "document_type": "invoice" | "receipt" | "credit_note" | "statement",
  "supplier": {
    "name": "string",
    "address": "string or null",
    "vat_number": "string or null",
    "phone": "string or null",
    "email": "string or null"
  },
  "document_number": "string or null",
  "date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "currency": "EUR" | "GBP" | "USD",
  "line_items": [
    {
      "description": "exact text as printed",
      "quantity": number or null,
      "unit_price": number or null,
      "vat_rate": number or null,
      "total": number
    }
  ],
  "subtotal": number or null,
  "vat_amount": number or null,
  "vat_rate": number or null,
  "total": number,
  "payment_method": "cash" | "card" | "bank_transfer" | "direct_debit" | null,
  "payment_status": "paid" | "unpaid" | "partial" | null,
  "payment_terms": "string or null",
  "purchase_description": "brief plain-English summary of what was bought",
  "raw_text": "all visible text",
  "confidence": 0.0-1.0
}`;

/** Check if a content type is an image */
function isImage(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/** Check if a content type is a PDF */
function isPdf(contentType: string): boolean {
  return contentType === "application/pdf" || contentType.includes("pdf");
}

/** Download a file from Supabase Storage and return as base64 */
async function downloadAsBase64(path: string): Promise<{ base64: string; contentType: string } | null> {
  const { data, error } = await supabase.storage
    .from("inbound-attachments")
    .download(path);

  if (error || !data) {
    console.error(`[Extract] Download error for ${path}:`, error);
    return null;
  }

  const buffer = await data.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const contentType = data.type || guessContentType(path);
  return { base64, contentType };
}

/** Guess content type from filename */
function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
  };
  return map[ext] || "application/octet-stream";
}

/** Generate a document hash for dedup: supplier + amount + date */
function generateDocHash(data: Record<string, unknown>): string {
  const supplier = ((data.supplier as Record<string, unknown>)?.name as string ?? "").toLowerCase().trim();
  const total = data.total ?? 0;
  const date = data.date ?? "";
  const docNum = data.document_number ?? "";
  const raw = `${supplier}|${total}|${date}|${docNum}`;
  // Simple hash — good enough for dedup
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

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

    // Fetch the email record
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

    if (email.status !== "extracting") {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, status: email.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const attachmentPaths = (email.attachment_paths as string[]) ?? [];
    const bodyText = (email.body_text as string) ?? "";

    // Build content for the AI model
    // Strategy: process each attachment + email body
    const contentParts: Array<Record<string, unknown>> = [];

    // Add email body context
    if (bodyText.length > 50) {
      contentParts.push({
        type: "text",
        text: `Email subject: ${email.subject || "(none)"}\n\nEmail body:\n${bodyText.substring(0, 10000)}`,
      });
    }

    // Add attachments as images (for vision model)
    let hasVisionContent = false;
    for (const path of attachmentPaths) {
      const file = await downloadAsBase64(path);
      if (!file) continue;

      if (isImage(file.contentType)) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${file.contentType};base64,${file.base64}` },
        });
        hasVisionContent = true;
      } else if (isPdf(file.contentType)) {
        // For PDFs, send as data URL — Gemini Flash handles PDF vision
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:application/pdf;base64,${file.base64}` },
        });
        hasVisionContent = true;
      }
    }

    // If no vision content and body is too short, mark as failed
    if (!hasVisionContent && bodyText.length < 50) {
      await supabase
        .from("inbound_emails")
        .update({ status: "failed", extraction_confidence: 0 })
        .eq("id", inbound_email_id);

      return new Response(
        JSON.stringify({ ok: false, reason: "No extractable content" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If only email body (no attachments), the invoice might be in the HTML body
    if (!hasVisionContent) {
      contentParts.push({
        type: "text",
        text: "Note: There are no attachments. The invoice/receipt data may be in the email body above. Extract what you can from the email text.",
      });
    } else {
      contentParts.push({
        type: "text",
        text: "Extract all financial data from the attached document(s). If the email body contains additional context (like a purchase order number), include that too.",
      });
    }

    // Call vision model
    const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: contentParts },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[Extract] AI error:", aiResponse.status, errText);
      await supabase
        .from("inbound_emails")
        .update({ status: "failed" })
        .eq("id", inbound_email_id);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content ?? "{}";

    let extractedData: Record<string, unknown>;
    try {
      extractedData = JSON.parse(content);
    } catch {
      console.error("[Extract] Failed to parse:", content);
      await supabase
        .from("inbound_emails")
        .update({ status: "failed", extraction_confidence: 0 })
        .eq("id", inbound_email_id);
      return new Response(
        JSON.stringify({ ok: false, reason: "Invalid AI response" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const confidence = (extractedData.confidence as number) ?? 0.5;
    const docHash = generateDocHash(extractedData);

    // Check for duplicate document
    const { data: existing } = await supabase
      .from("inbound_emails")
      .select("id")
      .eq("document_hash", docHash)
      .eq("client_user_id", email.client_user_id)
      .neq("id", inbound_email_id)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[Extract] Duplicate document detected for email ${inbound_email_id}`);
      await supabase
        .from("inbound_emails")
        .update({
          status: "ignored",
          extracted_data: extractedData,
          extraction_confidence: Math.round(confidence * 100),
          document_hash: docHash,
        })
        .eq("id", inbound_email_id);

      return new Response(
        JSON.stringify({ ok: true, duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Save extraction results
    await supabase
      .from("inbound_emails")
      .update({
        status: "enriching",
        extracted_data: extractedData,
        extraction_confidence: Math.round(confidence * 100),
        document_hash: docHash,
      })
      .eq("id", inbound_email_id);

    console.log(`[Extract] Email ${inbound_email_id}: ${extractedData.document_type} from ${(extractedData.supplier as Record<string, unknown>)?.name ?? "unknown"} — €${extractedData.total} (${(confidence * 100).toFixed(0)}%)`);

    // Trigger Stage 4 (enrich-and-route)
    supabase.functions.invoke("enrich-and-route-document", {
      body: { inbound_email_id },
    }).catch((err: unknown) => console.error("[Extract] Enrich trigger failed:", err));

    return new Response(
      JSON.stringify({
        ok: true,
        email_id: inbound_email_id,
        extracted: extractedData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Extract] Error:", error);
    return new Response(
      JSON.stringify({ error: "Extraction failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
