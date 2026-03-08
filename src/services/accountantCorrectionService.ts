import { supabase } from "@/integrations/supabase/client";
import { extractVendorPattern } from "@/lib/correctionUtils";
import type { AccountantCorrection } from "@/types/accountant";

interface RecordAccountantCorrectionInput {
  accountantId: string;
  practiceId: string;
  clientUserId: string;
  accountantClientId: string;
  transactionDescription: string;
  transactionAmount: number | null;
  transactionType: string | null;
  originalCategory: string | null;
  originalCategoryId: string | null;
  correctedCategory: string;
  correctedCategoryId: string;
  originalVatRate: number | null;
  correctedVatRate: number | null;
  clientIndustry: string | null;
  clientBusinessType: string | null;
}

/**
 * Record an accountant's correction when they recategorise a client's transaction.
 * Unlike user corrections (which need 3 repetitions), accountant corrections
 * are immediately high-confidence (90%) and contribute to the global vendor intelligence.
 *
 * If the same accountant corrected the same vendor pattern before, increments the count.
 * Also immediately saves to the client's vendor_cache (source: 'accountant').
 */
export async function recordAccountantCorrection(
  input: RecordAccountantCorrectionInput,
): Promise<void> {
  const vendorPattern = extractVendorPattern(input.transactionDescription);
  if (!vendorPattern) return;

  try {
    // Upsert: same accountant + vendor pattern + industry = update count
    const { data: existing } = await supabase
      .from("accountant_corrections")
      .select("*")
      .eq("accountant_id", input.accountantId)
      .eq("vendor_pattern", vendorPattern)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("accountant_corrections")
        .update({
          corrected_category: input.correctedCategory,
          corrected_category_id: input.correctedCategoryId,
          corrected_vat_rate: input.correctedVatRate,
          correction_count: (existing.correction_count ?? 1) + 1,
          transaction_amount: input.transactionAmount,
          transaction_type: input.transactionType,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("accountant_corrections").insert({
        accountant_id: input.accountantId,
        practice_id: input.practiceId,
        client_user_id: input.clientUserId,
        accountant_client_id: input.accountantClientId,
        vendor_pattern: vendorPattern,
        transaction_description: input.transactionDescription,
        original_category: input.originalCategory,
        original_category_id: input.originalCategoryId,
        corrected_category: input.correctedCategory,
        corrected_category_id: input.correctedCategoryId,
        original_vat_rate: input.originalVatRate,
        corrected_vat_rate: input.correctedVatRate,
        client_industry: input.clientIndustry,
        client_business_type: input.clientBusinessType,
        transaction_amount: input.transactionAmount,
        transaction_type: input.transactionType,
      });
    }

    // Immediately save to client's vendor_cache with high confidence
    // This means the NEXT time this vendor appears for this client, it's auto-categorised
    await saveAccountantCorrectionToClientCache(
      input.clientUserId,
      vendorPattern,
      input.correctedCategory,
      input.correctedVatRate,
    );

    // Try to promote to global if multiple accountants agree
    await tryPromoteToGlobal();

    // Fire-and-forget: trigger the diagnostic agent to figure out WHY we got it wrong
    triggerCorrectionAnalysis({
      correctionId: existing?.id || null,
      vendorPattern,
      transactionDescription: input.transactionDescription,
      originalCategory: input.originalCategory,
      correctedCategory: input.correctedCategory,
      clientUserId: input.clientUserId,
      transactionAmount: input.transactionAmount,
      originalVatRate: input.originalVatRate,
      correctedVatRate: input.correctedVatRate,
    });

    console.log(
      `[AccountantCorrections] Recorded: "${vendorPattern}" → ${input.correctedCategory} (accountant: ${input.accountantId})`,
    );
  } catch (error) {
    console.error("[AccountantCorrections] Failed to record:", error);
  }
}

/**
 * Save an accountant's correction directly to the client's vendor cache.
 * Source = 'accountant', confidence = 95 (higher than user corrections at 90).
 */
async function saveAccountantCorrectionToClientCache(
  clientUserId: string,
  vendorPattern: string,
  category: string,
  vatRate: number | null,
): Promise<void> {
  let vatType = "Standard 23%";
  if (vatRate === 13.5) vatType = "Reduced 13.5%";
  else if (vatRate === 9) vatType = "Second Reduced 9%";
  else if (vatRate === 0) vatType = "Zero";
  else if (vatRate === null) vatType = "N/A";

  await supabase.from("vendor_cache").upsert(
    {
      vendor_pattern: vendorPattern,
      normalized_name: vendorPattern,
      category,
      vat_type: vatType,
      vat_deductible: vatRate !== null && vatRate > 0,
      business_purpose: "Accountant-verified categorisation.",
      confidence: 95,
      source: "accountant",
      user_id: clientUserId,
      hit_count: 1,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "vendor_pattern,user_id" },
  );
}

/**
 * Call the database function to promote corrections where 2+ accountants agree
 * to the global vendor_cache (user_id IS NULL).
 * Fire-and-forget — errors are logged but don't block the UI.
 */
async function tryPromoteToGlobal(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("promote_accountant_corrections");
    if (error) {
      console.error("[AccountantCorrections] Promotion error:", error);
      return;
    }
    if (data && data > 0) {
      console.log(`[AccountantCorrections] Promoted ${data} corrections to global cache`);
    }
  } catch {
    // Fire-and-forget
  }
}

/**
 * Load all corrections made by an accountant, optionally filtered by client.
 */
export async function loadAccountantCorrections(
  accountantId: string,
  clientUserId?: string,
): Promise<AccountantCorrection[]> {
  try {
    let query = supabase
      .from("accountant_corrections")
      .select("*")
      .eq("accountant_id", accountantId)
      .order("updated_at", { ascending: false });

    if (clientUserId) {
      query = query.eq("client_user_id", clientUserId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AccountantCorrection[];
  } catch (error) {
    console.error("[AccountantCorrections] Load error:", error);
    return [];
  }
}

/**
 * Fire-and-forget: trigger the diagnostic agent to analyse why the
 * original categorisation was wrong. The agent uses web search, receipt OCR,
 * onboarding cross-reference, and VAT rules to determine root cause.
 */
function triggerCorrectionAnalysis(input: {
  correctionId: string | null;
  vendorPattern: string;
  transactionDescription: string;
  originalCategory: string | null;
  correctedCategory: string;
  clientUserId: string;
  transactionAmount: number | null;
  originalVatRate: number | null;
  correctedVatRate: number | null;
}): void {
  supabase.functions
    .invoke("analyse-correction", {
      body: {
        correction_id: input.correctionId,
        vendor_pattern: input.vendorPattern,
        transaction_description: input.transactionDescription,
        original_category: input.originalCategory,
        corrected_category: input.correctedCategory,
        client_user_id: input.clientUserId,
        transaction_amount: input.transactionAmount,
        original_vat_rate: input.originalVatRate,
        corrected_vat_rate: input.correctedVatRate,
      },
    })
    .then((res) => {
      if (res.data?.ok) {
        console.log(`[CorrectionAnalysis] Analysis complete for "${input.vendorPattern}": ${res.data.analysis?.root_cause}`);
      }
    })
    .catch((err) => {
      console.error("[CorrectionAnalysis] Failed:", err);
    });
}

/**
 * Load vendor intelligence: aggregated corrections across all accountants.
 * Used by the categorisation pipeline to check accountant consensus.
 */
export async function loadVendorIntelligence(
  vendorPattern?: string,
  industry?: string,
): Promise<Array<{
  vendor_pattern: string;
  corrected_category: string;
  corrected_vat_rate: number | null;
  confidence: number;
  accountant_count: number;
}>> {
  try {
    let query = supabase.from("vendor_intelligence").select("*");

    if (vendorPattern) {
      query = query.eq("vendor_pattern", vendorPattern);
    }
    if (industry) {
      query = query.eq("client_industry", industry);
    }

    const { data, error } = await query.order("confidence", { ascending: false });
    if (error) throw error;
    return data ?? [];
  } catch (error) {
    console.error("[VendorIntelligence] Load error:", error);
    return [];
  }
}
