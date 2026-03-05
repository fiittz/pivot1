/**
 * Stage 4+5: Enrich & Route — matches extracted document data to bank
 * transactions, auto-categorises using vendor intelligence + vendor cache,
 * and routes based on confidence.
 *
 * Routing:
 *   >=90% confidence → auto_filed (create receipt, link to transaction)
 *   70-89%           → pending_review (client confirms in app)
 *   <70%             → accountant_queue (accountant reviews)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Score how well a transaction matches extracted document data */
function matchScore(
  txn: { amount: number; transaction_date: string; description: string },
  doc: { total: number; date: string; supplierName: string },
): number {
  // Amount proximity (within €1 = perfect, within €5 = good)
  const amountDiff = Math.abs(Math.abs(txn.amount) - Math.abs(doc.total));
  let amountScore = 0;
  if (amountDiff < 0.01) amountScore = 1.0;
  else if (amountDiff <= 1) amountScore = 0.9;
  else if (amountDiff <= 5) amountScore = 0.6;
  else if (amountDiff <= 20) amountScore = 0.3;
  else return 0; // Too far off

  // Date proximity (same day = perfect, within 5 days = ok)
  const txnDate = new Date(txn.transaction_date);
  const docDate = new Date(doc.date);
  const daysDiff = Math.abs((txnDate.getTime() - docDate.getTime()) / 86400000);
  let dateScore = 0;
  if (daysDiff <= 0) dateScore = 1.0;
  else if (daysDiff <= 1) dateScore = 0.9;
  else if (daysDiff <= 3) dateScore = 0.7;
  else if (daysDiff <= 5) dateScore = 0.5;
  else if (daysDiff <= 10) dateScore = 0.2;
  else return 0;

  // Description similarity (simple token overlap)
  const txnTokens = new Set(txn.description.toLowerCase().split(/\s+/).filter(t => t.length >= 3));
  const supplierTokens = doc.supplierName.toLowerCase().split(/\s+/).filter(t => t.length >= 3);
  const overlap = supplierTokens.filter(t => txnTokens.has(t)).length;
  const descScore = supplierTokens.length > 0 ? Math.min(overlap / supplierTokens.length, 1.0) : 0.3;

  // Weighted combination
  return (amountScore * 0.5) + (dateScore * 0.25) + (descScore * 0.25);
}

/** Map VAT rate number to our vat_type string */
function vatRateToType(rate: number | null): string {
  if (rate === 23) return "Standard 23%";
  if (rate === 13.5) return "Reduced 13.5%";
  if (rate === 9) return "Second Reduced 9%";
  if (rate === 0) return "Zero";
  return "N/A";
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

    // Fetch email with extracted data
    const { data: email, error } = await supabase
      .from("inbound_emails")
      .select("*")
      .eq("id", inbound_email_id)
      .single();

    if (error || !email || email.status !== "enriching") {
      return new Response(
        JSON.stringify({ error: "Email not found or not ready for enrichment" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const extracted = email.extracted_data as Record<string, unknown>;
    if (!extracted) {
      await supabase.from("inbound_emails").update({ status: "failed" }).eq("id", inbound_email_id);
      return new Response(
        JSON.stringify({ ok: false, reason: "No extracted data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientUserId = email.client_user_id as string;
    const supplier = extracted.supplier as Record<string, unknown> | null;
    const supplierName = (supplier?.name as string) ?? "";
    const docTotal = (extracted.total as number) ?? 0;
    const docDate = (extracted.date as string) ?? "";
    const vatRate = (extracted.vat_rate as number) ?? null;
    const extractionConfidence = (email.extraction_confidence as number) ?? 50;

    // ── Step 1: Match to vendor cache / vendor intelligence ──

    // Build vendor pattern (first 3 tokens, lowercased)
    const vendorPattern = supplierName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((t: string) => t.length >= 2)
      .slice(0, 3)
      .join(" ");

    let assignedCategory: string | null = null;
    let assignedCategoryId: string | null = null;
    let assignedVatRate: number | null = vatRate;
    let categoryConfidence = 0;

    // Check vendor_cache (user-specific + global)
    if (vendorPattern && clientUserId) {
      const { data: cacheEntries } = await supabase
        .from("vendor_cache")
        .select("*")
        .eq("vendor_pattern", vendorPattern)
        .or(`user_id.is.null,user_id.eq.${clientUserId}`)
        .order("source", { ascending: true }); // user overrides global

      if (cacheEntries && cacheEntries.length > 0) {
        const best = cacheEntries[cacheEntries.length - 1]; // Last = highest priority
        assignedCategory = best.category;
        categoryConfidence = best.confidence ?? 80;

        // Look up category ID
        const { data: cats } = await supabase
          .from("categories")
          .select("id")
          .eq("user_id", clientUserId)
          .ilike("name", `%${best.category}%`)
          .limit(1);

        if (cats && cats.length > 0) {
          assignedCategoryId = cats[0].id;
        }
      }
    }

    // If no cache hit, check vendor_intelligence (accountant consensus)
    if (!assignedCategory && vendorPattern) {
      const { data: intel } = await supabase
        .from("vendor_intelligence")
        .select("*")
        .eq("vendor_pattern", vendorPattern)
        .order("confidence", { ascending: false })
        .limit(1);

      if (intel && intel.length > 0 && intel[0].confidence >= 90) {
        assignedCategory = intel[0].corrected_category;
        assignedCategoryId = intel[0].corrected_category_id;
        assignedVatRate = intel[0].corrected_vat_rate;
        categoryConfidence = intel[0].confidence;
      }
    }

    // ── Step 2: Match to bank transaction ──

    let matchedTransactionId: string | null = null;
    let transactionMatchScore = 0;

    if (clientUserId && docTotal && docDate) {
      // Search for transactions within ±10 days and ±€20 of the document
      const searchStart = new Date(docDate);
      searchStart.setDate(searchStart.getDate() - 10);
      const searchEnd = new Date(docDate);
      searchEnd.setDate(searchEnd.getDate() + 10);

      const { data: candidates } = await supabase
        .from("transactions")
        .select("id, amount, transaction_date, description")
        .eq("user_id", clientUserId)
        .is("receipt_url", null) // Not already matched to a receipt
        .gte("transaction_date", searchStart.toISOString().split("T")[0])
        .lte("transaction_date", searchEnd.toISOString().split("T")[0])
        .limit(50);

      if (candidates && candidates.length > 0) {
        let bestScore = 0;
        let bestId: string | null = null;

        for (const txn of candidates) {
          const score = matchScore(
            { amount: txn.amount, transaction_date: txn.transaction_date, description: txn.description ?? "" },
            { total: docTotal, date: docDate, supplierName },
          );
          if (score > bestScore) {
            bestScore = score;
            bestId = txn.id;
          }
        }

        if (bestScore >= 0.5) {
          matchedTransactionId = bestId;
          transactionMatchScore = bestScore;
        }
      }
    }

    // ── Step 3: Calculate overall confidence & route ──

    // Overall confidence = weighted average of extraction + category + transaction match
    const weights = {
      extraction: 0.4,
      category: assignedCategory ? 0.3 : 0,
      transaction: matchedTransactionId ? 0.3 : 0,
    };
    const totalWeight = weights.extraction + weights.category + weights.transaction;

    const overallConfidence = Math.round(
      ((extractionConfidence * weights.extraction) +
       (categoryConfidence * weights.category) +
       (transactionMatchScore * 100 * weights.transaction)) /
      (totalWeight || 1),
    );

    let route: string;
    if (overallConfidence >= 90 && assignedCategory && matchedTransactionId) {
      route = "auto_filed";
    } else if (overallConfidence >= 70) {
      route = "pending_review";
    } else {
      route = "accountant_queue";
    }

    // ── Step 4: Auto-file if high confidence ──

    let receiptId: string | null = null;

    if (route === "auto_filed" && clientUserId) {
      // Create receipt record
      const { data: receipt } = await supabase
        .from("receipts")
        .insert({
          user_id: clientUserId,
          vendor_name: supplierName,
          amount: docTotal,
          receipt_date: docDate || null,
          category_id: assignedCategoryId,
          vat_rate: assignedVatRate,
          vat_amount: (extracted.vat_amount as number) ?? null,
          transaction_id: matchedTransactionId,
          source: "email",
          ocr_data: extracted,
          notes: `Auto-filed from email: ${email.subject}`,
        })
        .select("id")
        .single();

      if (receipt) {
        receiptId = receipt.id;

        // Link transaction to receipt
        if (matchedTransactionId) {
          await supabase
            .from("transactions")
            .update({
              receipt_url: `inbound-email:${inbound_email_id}`,
              category_id: assignedCategoryId,
              vat_rate: assignedVatRate,
              notes: `[Auto-matched] ${supplierName} — €${docTotal} (${overallConfidence}% confidence)`,
            })
            .eq("id", matchedTransactionId);
        }
      }
    }

    // ── Step 5: Update email record with final results ──

    await supabase
      .from("inbound_emails")
      .update({
        status: "processed",
        matched_transaction_id: matchedTransactionId,
        assigned_category: assignedCategory,
        assigned_category_id: assignedCategoryId,
        assigned_vat_rate: assignedVatRate,
        enrichment_confidence: overallConfidence,
        route,
        receipt_id: receiptId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", inbound_email_id);

    console.log(
      `[Enrich] Email ${inbound_email_id}: ${route} — ` +
      `supplier=${supplierName}, amount=€${docTotal}, ` +
      `category=${assignedCategory ?? "unknown"}, ` +
      `transaction=${matchedTransactionId ? "matched" : "unmatched"}, ` +
      `confidence=${overallConfidence}%`,
    );

    // Log to audit trail
    if (clientUserId) {
      await supabase.from("audit_log").insert({
        user_id: clientUserId,
        entity_type: "inbound_email",
        entity_id: inbound_email_id,
        action: `document_${route}`,
        new_value: {
          supplier: supplierName,
          total: docTotal,
          category: assignedCategory,
          transaction_id: matchedTransactionId,
          route,
        },
        confidence_score: overallConfidence,
        explanation: `${extracted.document_type} from ${supplierName} — €${docTotal}. Route: ${route}.`,
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email_id: inbound_email_id,
        route,
        confidence: overallConfidence,
        supplier: supplierName,
        total: docTotal,
        category: assignedCategory,
        matched_transaction: matchedTransactionId,
        receipt_id: receiptId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Enrich] Error:", error);
    return new Response(
      JSON.stringify({ error: "Enrichment failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
