import { supabase } from "@/integrations/supabase/client";
import { autoCategorise, findMatchingCategory } from "@/lib/autocat";

export interface MatchCandidate {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  receipt_url: string | null;
}

export interface MatchResult {
  receiptId: string;
  transactionId: string | null;
  score: number;
  explanation: string;
  autoMatched: boolean;
}

const AUTO_MATCH_THRESHOLD = 0.85;

/**
 * Score a single candidate transaction against a receipt.
 *
 * Scoring breakdown (max 1.0):
 *   - Amount exact match (to the cent): 0.50
 *   - Vendor name found in description:  0.30
 *   - Date: same day = 0.20, +/-1 day = 0.15
 */
function scoreCandidate(
  candidate: MatchCandidate,
  receiptAmount: number,
  receiptVendor: string | null,
  receiptDate: string | null,
): { score: number; explanation: string } {
  let score = 0;
  const reasons: string[] = [];

  // --- Amount (0.50) - must be exact to the cent ---
  const candidateAbs = Math.abs(candidate.amount);
  const receiptAbs = Math.abs(receiptAmount);
  if (Math.abs(candidateAbs - receiptAbs) < 0.005) {
    score += 0.5;
    reasons.push(`Amount exact match: ${receiptAbs.toFixed(2)}`);
  }

  // --- Vendor (0.30) - fuzzy name match in description ---
  if (receiptVendor && candidate.description) {
    const descLower = candidate.description.toLowerCase();
    const vendorLower = receiptVendor.toLowerCase().trim();

    if (vendorLower && descLower.includes(vendorLower)) {
      score += 0.3;
      reasons.push(`Vendor full match: "${receiptVendor}"`);
    } else {
      // Check ANY word of vendor name (>= 3 chars) found in description
      // Handles cases like "TJ O Mahony" where first word "tj" is too short
      // but "mahony" matches "Tj O Mahony Finglas"
      const vendorWords = vendorLower.split(/[\s,.\-()]+/).filter((w) => w.length >= 3);
      const matchedWord = vendorWords.find((word) => descLower.includes(word));
      if (matchedWord) {
        score += 0.3;
        reasons.push(`Vendor partial match: "${matchedWord}"`);
      }
    }
  }

  // --- Date (0.20 same day, 0.15 +/-1 day) ---
  if (receiptDate && candidate.transaction_date) {
    const rDate = new Date(receiptDate);
    const tDate = new Date(candidate.transaction_date);
    const diffMs = Math.abs(rDate.getTime() - tDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 0.5) {
      score += 0.2;
      reasons.push("Date: same day");
    } else if (diffDays <= 1.5) {
      score += 0.15;
      reasons.push("Date: within +/-1 day");
    }
  }

  return {
    score: Math.round(score * 100) / 100,
    explanation: reasons.length > 0 ? reasons.join("; ") : "No matching criteria met",
  };
}

/**
 * Find the best matching unlinked transaction for a receipt.
 * Returns the match result including whether the threshold was met.
 */
export async function matchReceiptToTransaction(
  userId: string,
  receiptId: string,
  receiptAmount: number,
  receiptVendor: string | null,
  receiptDate: string | null,
  accountId?: string | null,
): Promise<MatchResult> {
  // Build query for unlinked transactions (no receipt attached)
  let query = supabase
    .from("transactions")
    .select("id, amount, description, transaction_date, receipt_url")
    .eq("user_id", userId)
    .is("receipt_url", null);

  // Scope to a specific bank account if provided
  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  // Narrow by date window if we have a receipt date (+/-2 days for query, score handles tighter check)
  if (receiptDate) {
    const d = new Date(receiptDate);
    const from = new Date(d);
    from.setDate(from.getDate() - 2);
    const to = new Date(d);
    to.setDate(to.getDate() + 2);
    query = query
      .gte("transaction_date", from.toISOString().split("T")[0])
      .lte("transaction_date", to.toISOString().split("T")[0]);
  }

  const { data: candidates, error } = await query;

  if (error) {
    console.error("Error querying transactions for matching:", error);
    return {
      receiptId,
      transactionId: null,
      score: 0,
      explanation: `Query error: ${error.message}`,
      autoMatched: false,
    };
  }

  if (!candidates || candidates.length === 0) {
    return {
      receiptId,
      transactionId: null,
      score: 0,
      explanation: "No candidate transactions found",
      autoMatched: false,
    };
  }

  // Score each candidate and pick the best
  let bestScore = 0;
  let bestCandidate: MatchCandidate | null = null;
  let bestExplanation = "";

  for (const c of candidates) {
    const { score, explanation } = scoreCandidate(c as MatchCandidate, receiptAmount, receiptVendor, receiptDate);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c as MatchCandidate;
      bestExplanation = explanation;
    }
  }

  const autoMatched = bestScore >= AUTO_MATCH_THRESHOLD && bestCandidate !== null;

  return {
    receiptId,
    transactionId: bestCandidate?.id ?? null,
    score: bestScore,
    explanation: bestExplanation,
    autoMatched,
  };
}

/**
 * Link a receipt to a transaction (used for both auto-match and manual assignment).
 * Updates both the receipt record and the transaction record.
 */
export async function linkReceiptToTransaction(
  receiptId: string,
  transactionId: string,
  imageUrl: string,
  receiptVatAmount?: number | null,
  receiptVatRate?: number | null,
): Promise<void> {
  // Update receipt: set transaction_id
  const { error: receiptError } = await supabase
    .from("receipts")
    .update({ transaction_id: transactionId })
    .eq("id", receiptId);

  if (receiptError) {
    throw new Error(`Failed to link receipt: ${receiptError.message}`);
  }

  // Update transaction: set receipt_url, optionally upgrade VAT data
  const txUpdate: Record<string, unknown> = { receipt_url: imageUrl };
  if (receiptVatAmount != null) txUpdate.vat_amount = receiptVatAmount;
  if (receiptVatRate != null) txUpdate.vat_rate = receiptVatRate;

  const { error: txError } = await supabase.from("transactions").update(txUpdate).eq("id", transactionId);

  if (txError) {
    throw new Error(`Failed to update transaction: ${txError.message}`);
  }
}

/**
 * Auto-categorize a transaction using receipt data (vendor name, line items).
 * Only updates transactions that have no category set (category_id IS NULL).
 */
export async function categorizeFromReceipt(
  transactionId: string,
  receiptData: {
    supplier_name: string | null;
    line_items?: { description: string }[];
    total_amount: number;
    date: string | null;
  },
  categories: { id: string; name: string; type: string; account_type: string }[],
  businessType: string,
  accountType?: string,
): Promise<void> {
  // Build a description from receipt data
  const parts: string[] = [];
  if (receiptData.supplier_name) parts.push(receiptData.supplier_name);
  if (receiptData.line_items?.length) {
    parts.push(receiptData.line_items.map((i) => i.description).join(", "));
  }
  const description = parts.join(" — ");
  if (!description) return;

  // Build receipt_text for the autocat receipt-refinement pass
  const receiptText = JSON.stringify(receiptData);

  // Run the sync autocat engine
  const result = autoCategorise({
    amount: -Math.abs(receiptData.total_amount),
    date: receiptData.date || new Date().toISOString(),
    currency: "EUR",
    description,
    direction: "expense",
    user_industry: businessType,
    user_business_type: businessType,
    receipt_text: receiptText,
    account_type: accountType,
  });

  // Resolve the autocat category string to a DB category
  const matchedCategory = findMatchingCategory(result.category, categories, "expense", accountType);
  if (!matchedCategory) return;

  // Update only if the transaction has no category set
  await supabase
    .from("transactions")
    .update({ category_id: matchedCategory.id })
    .eq("id", transactionId)
    .is("category_id", null);
}
