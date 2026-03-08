// ────────────────────────────────────────────
// Transaction Matching Engine
// Pure functions — no React, no Supabase
// Core principle: NEVER ASSUME — suggest, never auto-apply
// ────────────────────────────────────────────

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface BankTransaction {
  id: string;
  account_id: string;
  user_id: string;
  transaction_date: string;
  description: string;
  reference?: string;
  amount: number; // positive = credit/income, negative = debit/expense
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  due_date: string;
  invoice_date: string;
  status: string;
  payment_method?: string;
}

export interface PayrollLine {
  employee_name: string;
  net_pay: number;
  employer_prsi: number;
  total_deductions: number;
  pay_date: string;
}

export interface VendorRule {
  vendor_pattern: string; // normalized description
  category_id: string;
  category_name: string;
  avg_amount: number;
  confirmation_count: number;
}

export interface MatchResult {
  transaction_id: string;
  match_type: "transfer" | "invoice" | "payroll" | "vendor_rule" | "uncategorised";
  confidence: number; // 0-100
  suggested_category_id?: string;
  suggested_category_name?: string;
  matched_invoice_id?: string;
  matched_transfer_id?: string;
  details: string; // human-readable explanation
}

export interface MatchContext {
  otherTransactions: BankTransaction[];
  openInvoices: Invoice[];
  knownPayrollLines: PayrollLine[];
  historicalTransactions: BankTransaction[];
  vendorRules: VendorRule[];
}

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const BANK_PREFIXES = [
  "POS",
  "DD",
  "STO",
  "BGC",
  "FPI",
  "TFR",
  "CHQ",
  "ATM",
  "FPO",
  "DPC",
  "NDC",
  "BP",
  "CR",
  "DR",
];

const PAYROLL_KEYWORDS = [
  "salary",
  "wages",
  "payroll",
  "paye",
  "revenue commissioners",
  "revenue comm",
  "prsi",
  "net pay",
];

const TRANSFER_MAX_DAY_GAP = 2;
const INVOICE_AMOUNT_TOLERANCE = 0.01;
const INVOICE_SCORE_THRESHOLD = 50;
const PAYROLL_AMOUNT_TOLERANCE_PCT = 0.05; // 5%
const PAYROLL_DAY_TOLERANCE = 3;
const VENDOR_RULE_MIN_CONFIRMATIONS = 2;
const VENDOR_RULE_AMOUNT_TOLERANCE_PCT = 0.10; // 10%

// ────────────────────────────────────────────
// String Utilities
// ────────────────────────────────────────────

/**
 * Normalize a bank description for matching:
 * lowercase, strip excess whitespace, remove common bank prefixes
 */
export function normalizeDescription(desc: string): string {
  let normalized = desc.toLowerCase().trim();

  // Remove common bank prefixes (must be at start, followed by space or punctuation)
  for (const prefix of BANK_PREFIXES) {
    const pattern = new RegExp(`^${prefix.toLowerCase()}[\\s\\-/.:]+`, "i");
    normalized = normalized.replace(pattern, "");
  }

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Tokenize a string into word tokens, stripping non-alphanumeric chars
 */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Jaccard similarity on word tokens (0-1)
 */
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;

  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Simple Levenshtein distance
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimization
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,       // deletion
        curr[j - 1] + 1,   // insertion
        prev[j - 1] + cost  // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Fuzzy match returning 0-1 similarity score.
 * Uses a blend of Jaccard on word tokens (for reordered words)
 * and Levenshtein-based similarity (for typos/abbreviations).
 */
export function fuzzyMatch(a: string, b: string): number {
  const normA = normalizeDescription(a);
  const normB = normalizeDescription(b);

  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;

  // Jaccard on word tokens
  const tokensA = tokenize(normA);
  const tokensB = tokenize(normB);
  const jaccard = jaccardSimilarity(tokensA, tokensB);

  // Levenshtein-based similarity on the full normalized string
  const maxLen = Math.max(normA.length, normB.length);
  const levenshtein = 1 - levenshteinDistance(normA, normB) / maxLen;

  // Weighted blend: Jaccard handles word reordering, Levenshtein handles typos
  return Math.max(jaccard, levenshtein);
}

// ────────────────────────────────────────────
// Date Utilities
// ────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

function daysBetween(a: string, b: string): number {
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  return Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60 * 24);
}

function isAfter(a: string, b: string): boolean {
  return parseDate(a).getTime() >= parseDate(b).getTime();
}

function getDayOfMonth(dateStr: string): number {
  return parseDate(dateStr).getDate();
}

// ────────────────────────────────────────────
// 1. Transfer Detection
// ────────────────────────────────────────────

/**
 * Detect if this transaction is a transfer between the user's own accounts.
 * Matches: same amount (opposite signs), within 2 days, different accounts, same user.
 */
export function detectTransfer(
  txn: BankTransaction,
  otherTransactions: BankTransaction[],
): MatchResult | null {
  for (const other of otherTransactions) {
    // Must be a different account
    if (other.account_id === txn.account_id) continue;
    // Must be same user
    if (other.user_id !== txn.user_id) continue;
    // Must be same transaction (skip self)
    if (other.id === txn.id) continue;
    // Opposite signs, same absolute amount
    if (Math.abs(txn.amount + other.amount) > 0.01) continue;
    // Within 2 days
    if (daysBetween(txn.transaction_date, other.transaction_date) > TRANSFER_MAX_DAY_GAP) continue;

    const direction = txn.amount > 0 ? "inbound from" : "outbound to";
    return {
      transaction_id: txn.id,
      match_type: "transfer",
      confidence: 95,
      matched_transfer_id: other.id,
      details: `Likely transfer: ${direction} account ${other.account_id} (${other.description}). Amount matches exactly, ${daysBetween(txn.transaction_date, other.transaction_date).toFixed(0)} day(s) apart.`,
    };
  }

  return null;
}

// ────────────────────────────────────────────
// 2. Invoice Matching
// ────────────────────────────────────────────

/**
 * Score a transaction against open invoices and return the best match.
 * Scoring: exact amount = 50pts, reference match = 30pts, customer name = 15pts,
 * date within 7 days of due date = 5pts. Threshold: 50pts.
 */
export function matchInvoice(
  txn: BankTransaction,
  openInvoices: Invoice[],
): MatchResult | null {
  // Only match credit (income) transactions to invoices
  if (txn.amount <= 0) return null;

  let bestMatch: { invoice: Invoice; score: number; reasons: string[] } | null = null;

  for (const inv of openInvoices) {
    // Must be after invoice date
    if (!isAfter(txn.transaction_date, inv.invoice_date)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Exact amount match (within rounding tolerance)
    if (Math.abs(txn.amount - inv.total_amount) <= INVOICE_AMOUNT_TOLERANCE) {
      score += 50;
      reasons.push(`exact amount match (${txn.amount.toFixed(2)})`);
    }

    // Reference/description contains invoice number
    const txnText = `${txn.description} ${txn.reference ?? ""}`.toLowerCase();
    if (inv.invoice_number && txnText.includes(inv.invoice_number.toLowerCase())) {
      score += 30;
      reasons.push(`reference contains invoice number "${inv.invoice_number}"`);
    }

    // Customer name appears in description
    if (inv.customer_name) {
      const customerNorm = inv.customer_name.toLowerCase();
      const descNorm = txn.description.toLowerCase();
      if (descNorm.includes(customerNorm) || fuzzyMatch(descNorm, customerNorm) > 0.7) {
        score += 15;
        reasons.push(`customer name "${inv.customer_name}" found in description`);
      }
    }

    // Date within 7 days of due date
    if (daysBetween(txn.transaction_date, inv.due_date) <= 7) {
      score += 5;
      reasons.push("payment date within 7 days of due date");
    }

    if (score >= INVOICE_SCORE_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { invoice: inv, score, reasons };
    }
  }

  if (!bestMatch) return null;

  return {
    transaction_id: txn.id,
    match_type: "invoice",
    confidence: Math.min(bestMatch.score, 100),
    matched_invoice_id: bestMatch.invoice.id,
    details: `Matches invoice ${bestMatch.invoice.invoice_number} (${bestMatch.invoice.customer_name}): ${bestMatch.reasons.join("; ")}. Score: ${bestMatch.score}/100.`,
  };
}

// ────────────────────────────────────────────
// 3. Payroll Pattern Detection
// ────────────────────────────────────────────

/**
 * Detect payroll-related transactions.
 * Checks description keywords, known payroll line amounts, and recurring monthly patterns.
 */
export function detectPayroll(
  txn: BankTransaction,
  knownPayrollLines: PayrollLine[],
  historicalTxns: BankTransaction[],
): MatchResult | null {
  // Payroll payments are typically debits (negative)
  if (txn.amount > 0) return null;

  const absAmount = Math.abs(txn.amount);
  const descNorm = normalizeDescription(txn.description);
  const reasons: string[] = [];
  let confidence = 0;

  // Check description for payroll keywords
  const hasPayrollKeyword = PAYROLL_KEYWORDS.some((kw) => descNorm.includes(kw));
  if (hasPayrollKeyword) {
    confidence += 40;
    reasons.push("description contains payroll keyword");
  }

  // Check if amount matches a known payroll line (net pay, employer PRSI, or total deductions)
  for (const pl of knownPayrollLines) {
    const matchAmounts = [pl.net_pay, pl.employer_prsi, pl.total_deductions];
    for (const matchAmt of matchAmounts) {
      if (matchAmt > 0 && Math.abs(absAmount - matchAmt) / matchAmt <= PAYROLL_AMOUNT_TOLERANCE_PCT) {
        confidence += 35;
        reasons.push(`amount matches known payroll line for ${pl.employee_name} (${matchAmt.toFixed(2)})`);
        break;
      }
    }
    if (reasons.length > (hasPayrollKeyword ? 1 : 0)) break; // found a match
  }

  // Check for round amount (common in salary payments)
  if (absAmount > 0 && absAmount === Math.round(absAmount)) {
    confidence += 5;
    reasons.push("round amount");
  }

  // Check for recurring monthly pattern in historical transactions
  const txnDay = getDayOfMonth(txn.transaction_date);
  const similarHistorical = historicalTxns.filter((h) => {
    if (h.id === txn.id) return false;
    if (h.account_id !== txn.account_id) return false;
    if (h.amount > 0) return false; // only debits

    const hAbsAmount = Math.abs(h.amount);
    const amountClose = Math.abs(hAbsAmount - absAmount) / absAmount <= PAYROLL_AMOUNT_TOLERANCE_PCT;
    const dayClose = Math.abs(getDayOfMonth(h.transaction_date) - txnDay) <= PAYROLL_DAY_TOLERANCE;
    const descMatch = fuzzyMatch(h.description, txn.description) > 0.6;

    return amountClose && dayClose && descMatch;
  });

  if (similarHistorical.length >= 2) {
    confidence += 20;
    reasons.push(`recurring monthly pattern (${similarHistorical.length} similar transactions found)`);
  }

  if (confidence < 30) return null;

  return {
    transaction_id: txn.id,
    match_type: "payroll",
    confidence: Math.min(confidence, 100),
    details: `Payroll pattern detected: ${reasons.join("; ")}. Confidence: ${Math.min(confidence, 100)}%.`,
  };
}

// ────────────────────────────────────────────
// 4. Vendor Rule Matching
// ────────────────────────────────────────────

/**
 * Match against vendor rules built from previously categorised transactions.
 * A vendor rule must have been confirmed at least 2 times to be used.
 */
export function matchVendorRule(
  txn: BankTransaction,
  vendorRules: VendorRule[],
): MatchResult | null {
  const txnNorm = normalizeDescription(txn.description);
  const absAmount = Math.abs(txn.amount);

  let bestMatch: { rule: VendorRule; similarity: number } | null = null;

  for (const rule of vendorRules) {
    // Must have enough confirmations
    if (rule.confirmation_count < VENDOR_RULE_MIN_CONFIRMATIONS) continue;

    // Fuzzy match on vendor pattern
    const similarity = fuzzyMatch(txnNorm, rule.vendor_pattern);
    if (similarity < 0.6) continue;

    // Amount range check (within 10%)
    if (rule.avg_amount > 0 && absAmount > 0) {
      const amountDiff = Math.abs(absAmount - rule.avg_amount) / rule.avg_amount;
      if (amountDiff > VENDOR_RULE_AMOUNT_TOLERANCE_PCT) continue;
    }

    if (!bestMatch || similarity > bestMatch.similarity) {
      bestMatch = { rule, similarity };
    }
  }

  if (!bestMatch) return null;

  const confidence = Math.round(bestMatch.similarity * 70 + 10); // Scale: 0.6 similarity = 52%, 1.0 = 80%
  return {
    transaction_id: txn.id,
    match_type: "vendor_rule",
    confidence: Math.min(confidence, 100),
    suggested_category_id: bestMatch.rule.category_id,
    suggested_category_name: bestMatch.rule.category_name,
    details: `Matches vendor rule "${bestMatch.rule.vendor_pattern}" (${bestMatch.rule.category_name}). Confirmed ${bestMatch.rule.confirmation_count} times. Similarity: ${(bestMatch.similarity * 100).toFixed(0)}%.`,
  };
}

// ────────────────────────────────────────────
// 5. Main Pipeline
// ────────────────────────────────────────────

/**
 * Run the matching pipeline in priority order:
 * 1. Transfer detection
 * 2. Invoice match
 * 3. Payroll pattern
 * 4. Vendor rule match
 * 5. Uncategorised (fallback)
 *
 * Returns the best MatchResult. NEVER auto-applies — always a suggestion.
 */
export function matchTransaction(
  txn: BankTransaction,
  context: MatchContext,
): MatchResult {
  // Priority 1: Transfer detection
  const transfer = detectTransfer(txn, context.otherTransactions);
  if (transfer) return transfer;

  // Priority 2: Invoice match
  const invoice = matchInvoice(txn, context.openInvoices);
  if (invoice) return invoice;

  // Priority 3: Payroll pattern
  const payroll = detectPayroll(txn, context.knownPayrollLines, context.historicalTransactions);
  if (payroll) return payroll;

  // Priority 4: Vendor rule match
  const vendorRule = matchVendorRule(txn, context.vendorRules);
  if (vendorRule) return vendorRule;

  // Priority 5: No match — Uncategorised
  return {
    transaction_id: txn.id,
    match_type: "uncategorised",
    confidence: 0,
    details: "No match found. Transaction requires manual categorisation.",
  };
}

/**
 * Run matching on a batch of transactions. Returns results sorted by confidence (highest first).
 */
export function matchTransactions(
  transactions: BankTransaction[],
  context: MatchContext,
): MatchResult[] {
  return transactions
    .map((txn) => matchTransaction(txn, context))
    .sort((a, b) => b.confidence - a.confidence);
}
