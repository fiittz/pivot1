/**
 * VAT Deductibility Helper
 * Applies Irish VAT Section 59/60 rules to determine if VAT is recoverable
 */

import { DISALLOWED_VAT_CREDITS, ALLOWED_VAT_CREDITS } from "./irishVatRules";

export interface VATDeductibilityResult {
  isDeductible: boolean;
  reason: string;
  section?: string;
}

/**
 * Determines if VAT on an expense transaction is deductible
 * Based on Section 60(2) VAT Consolidation Act 2010
 */
export function isVATDeductible(
  description: string,
  categoryName?: string | null,
  accountName?: string | null,
): VATDeductibilityResult {
  const descLower = (description || "").toLowerCase();
  const catLower = (categoryName || "").toLowerCase();
  const accLower = (accountName || "").toLowerCase();
  const combined = `${descLower} ${catLower} ${accLower}`;

  // ── Section 60 keyword checks (description-based) ──

  // Section 60(2)(a)(i) - Food, drink, accommodation
  const foodWordBoundary = DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.wordBoundaryKeywords || [];
  const foodWordMatch = foodWordBoundary.some((k: string) => new RegExp(`\\b${k}\\b`).test(combined));
  if (foodWordMatch || DISALLOWED_VAT_CREDITS.FOOD_DRINK_ACCOMMODATION.keywords.some((k) => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Food, drink or accommodation - VAT NOT recoverable",
      section: "Section 60(2)(a)(i)",
    };
  }

  // Section 60(2)(a)(iii) - Entertainment
  const entertainWordBoundary = DISALLOWED_VAT_CREDITS.ENTERTAINMENT.wordBoundaryKeywords || [];
  const entertainWordMatch = entertainWordBoundary.some((k: string) => new RegExp(`\\b${k}\\b`).test(combined));
  if (entertainWordMatch || DISALLOWED_VAT_CREDITS.ENTERTAINMENT.keywords.some((k) => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Entertainment expense - VAT NOT recoverable",
      section: "Section 60(2)(a)(iii)",
    };
  }

  // Section 60(2)(a)(iv) - Passenger motor vehicles
  if (DISALLOWED_VAT_CREDITS.PASSENGER_VEHICLES.keywords.some((k) => combined.includes(k))) {
    return {
      isDeductible: false,
      reason: "Passenger vehicle purchase/hire - VAT NOT recoverable",
      section: "Section 60(2)(a)(iv)",
    };
  }

  // Section 60(2)(a)(v) - Petrol (but not diesel!)
  const hasPetrol = DISALLOWED_VAT_CREDITS.PETROL.keywords.some((k) => combined.includes(k));
  const hasDiesel = ALLOWED_VAT_CREDITS.DIESEL.keywords!.some((k) => combined.includes(k));

  if (hasPetrol && !hasDiesel) {
    return {
      isDeductible: false,
      reason: "Petrol - VAT NOT recoverable (diesel IS deductible)",
      section: "Section 60(2)(a)(v)",
    };
  }

  // Diesel IS deductible
  if (hasDiesel) {
    return {
      isDeductible: true,
      reason: "Diesel fuel - VAT IS recoverable",
    };
  }

  // Mixed fuel retailers without receipt - conservative approach
  const fuelStations = ["maxol", "circle k", "applegreen", "texaco", "esso", "shell", "topaz", "spar", "centra"];
  if (fuelStations.some((f) => combined.includes(f))) {
    if (combined.includes("diesel") || (combined.includes("fuel") && !combined.includes("petrol"))) {
      return {
        isDeductible: true,
        reason: "Fuel purchase - categorized as deductible",
      };
    }
    return {
      isDeductible: false,
      reason: "Mixed retailer - cannot claim VAT without receipt proving diesel",
      section: "Section 60",
    };
  }

  // Non-business expenses
  if (combined.includes("personal") || combined.includes("private") || combined.includes("non-business")) {
    return {
      isDeductible: false,
      reason: "Non-business expense - VAT NOT recoverable",
      section: "Section 59",
    };
  }

  // Bank charges and fees - VAT exempt, VAT NOT recoverable
  if (combined.includes("bank") && (combined.includes("fee") || combined.includes("charge"))) {
    return {
      isDeductible: false,
      reason: "Bank charges — VAT exempt supply, VAT not recoverable",
    };
  }

  // Insurance - VAT exempt, VAT NOT recoverable
  if (combined.includes("insurance") && !combined.includes("motor tax")) {
    return {
      isDeductible: false,
      reason: "Insurance — VAT exempt supply, VAT not recoverable",
    };
  }

  // ── Category-based checks ──

  // Meals & Entertainment — not an allowable tax deduction
  if (catLower.includes("meals") || catLower === "entertainment") {
    return {
      isDeductible: false,
      reason: "Meals & Entertainment — not an allowable tax deduction",
      section: "Section 60(2)(a)(i)/(iii)",
    };
  }

  // Fines & Penalties — never deductible for tax purposes
  if (
    catLower.includes("fine") ||
    catLower.includes("penalt") ||
    /\bfines?\b/.test(descLower) ||
    /\bpenalt(y|ies)\b/.test(descLower)
  ) {
    return {
      isDeductible: false,
      reason: "Fines & penalties are not allowable tax deductions",
    };
  }

  // Director's Loan Account — balance sheet item, not a P&L expense
  if (catLower.includes("director's loan") || catLower.includes("directors loan") || catLower.includes("drawing")) {
    return {
      isDeductible: false,
      reason: "Director's Loan Account — balance sheet movement, not a deductible expense",
    };
  }

  // Dividends — distribution of profits, not a deductible expense
  if (catLower.includes("dividend")) {
    return {
      isDeductible: false,
      reason: "Dividends — profit distribution, not deductible for Corporation Tax",
    };
  }

  // Default: assume deductible for business expenses
  return {
    isDeductible: true,
    reason: "Business expense - VAT recoverable",
  };
}

/**
 * Calculate VAT amount from a gross amount using reverse calculation.
 * Accepts either a string key ("standard_23") or a numeric rate (23, 13.5, etc.).
 */
export function calculateVATFromGross(
  grossAmount: number,
  vatRateKey: string | number,
): { netAmount: number; vatAmount: number } {
  const rates: Record<string, number> = {
    standard_23: 0.23,
    reduced_13_5: 0.135,
    second_reduced_9: 0.09,
    livestock_4_8: 0.048,
    zero_rated: 0,
    exempt: 0,
  };

  let rate: number;
  if (typeof vatRateKey === "number") {
    // Numeric rate from DB (e.g. 23, 13.5, 9, 4.8, 0)
    rate = vatRateKey / 100;
  } else {
    rate = rates[vatRateKey] ?? 0.23;
  }

  if (rate === 0) {
    return { netAmount: grossAmount, vatAmount: 0 };
  }

  const vatAmount = Number(((grossAmount * rate) / (1 + rate)).toFixed(2));
  const netAmount = Number((grossAmount - vatAmount).toFixed(2));

  return { netAmount, vatAmount };
}

/**
 * CT Deductibility Classification
 *
 * Irish Corporation Tax (CT1) — Section 81 TCA 1997
 * General rule: expenses must be "wholly and exclusively" incurred for
 * the purposes of the trade.
 *
 * Returns classification: deductible | non_deductible | capital | needs_review
 */

export type CTDeductibility = "deductible" | "non_deductible" | "capital" | "needs_review";

export interface CTDeductibilityResult {
  isDeductible: boolean;
  classification: CTDeductibility;
  reason: string;
  legislation?: string;
}

// ── CATEGORY KEYWORD RULES ──────────────────────────────────────────────────

/** Always deductible — "wholly and exclusively" for the trade */
const DEDUCTIBLE_KEYWORDS: { keywords: string[]; reason: string; legislation?: string }[] = [
  // Wages & Salaries
  { keywords: ["wages", "salaries", "salary", "payroll", "gross pay"], reason: "Wages & salaries — allowable for CT", legislation: "s.81 TCA 1997" },
  { keywords: ["employer prsi", "employer's prsi", "employer pension", "pension contribution"], reason: "Employer PRSI / pension contributions — allowable for CT", legislation: "s.81 TCA 1997" },
  { keywords: ["staff training", "cpd", "professional development"], reason: "Staff training — allowable for CT", legislation: "s.81 TCA 1997" },
  // Rent & Rates
  { keywords: ["rent", "lease", "rates", "water rates", "council rates"], reason: "Rent & rates — allowable for CT", legislation: "s.81 TCA 1997" },
  // Utilities
  { keywords: ["electricity", "gas bill", "heating", "utility", "utilities", "water charge"], reason: "Utilities — allowable for CT", legislation: "s.81 TCA 1997" },
  // Insurance
  { keywords: ["insurance", "public liability", "employer's liability", "professional indemnity", "motor insurance"], reason: "Business insurance — allowable for CT", legislation: "s.81 TCA 1997" },
  // Repairs & Maintenance (not improvements)
  { keywords: ["repair", "maintenance", "servicing", "cleaning"], reason: "Repairs & maintenance — allowable for CT (not capital improvements)", legislation: "s.81 TCA 1997" },
  // Marketing & Advertising
  { keywords: ["marketing", "advertising", "advert", "promotion", "website", "seo", "social media", "branding"], reason: "Marketing & advertising — allowable for CT", legislation: "s.81 TCA 1997" },
  // Professional Fees
  { keywords: ["accountancy", "accountant", "legal fee", "solicitor", "consultant", "audit fee", "professional fee", "bookkeeping"], reason: "Professional fees — allowable for CT", legislation: "s.81 TCA 1997" },
  // Interest & Bank Charges
  { keywords: ["bank charge", "bank fee", "interest paid", "loan interest", "overdraft", "merchant fee", "stripe fee", "payment processing"], reason: "Interest & bank charges — allowable for CT", legislation: "s.81 TCA 1997" },
  // Bad Debts (specific)
  { keywords: ["bad debt", "write off", "write-off", "debt written off"], reason: "Specific bad debt — allowable for CT (must be proven uncollectible)", legislation: "s.81 TCA 1997" },
  // Materials & Stock
  { keywords: ["materials", "stock", "purchases", "cost of goods", "cost of sales", "cogs", "supplies", "consumables"], reason: "Materials & stock — allowable cost of sales for CT", legislation: "s.81 TCA 1997" },
  // Subcontractor costs
  { keywords: ["subcontract", "sub-contract", "contractor cost", "labour hire"], reason: "Subcontractor costs — allowable for CT", legislation: "s.81 TCA 1997" },
  // Travel & Subsistence (business only)
  { keywords: ["travel", "subsistence", "mileage", "accommodation", "hotel", "flight", "parking", "toll", "taxi", "train"], reason: "Travel & subsistence — allowable for CT (must be wholly for business, not commuting)", legislation: "s.81 TCA 1997" },
  // Motor
  { keywords: ["motor", "fuel", "diesel", "petrol", "vehicle expense", "motor tax", "nct"], reason: "Motor expenses — allowable for CT (business use portion)", legislation: "s.81 TCA 1997" },
  // Subscriptions & Software
  { keywords: ["subscription", "software", "saas", "licence", "license", "cloud", "hosting", "domain"], reason: "Subscriptions & software — allowable for CT", legislation: "s.81 TCA 1997" },
  // Office & Stationery
  { keywords: ["office", "stationery", "postage", "courier", "printing", "phone", "mobile", "broadband", "internet", "telecoms"], reason: "Office & telecoms — allowable for CT", legislation: "s.81 TCA 1997" },
  // Protective clothing & uniforms
  { keywords: ["ppe", "protective", "uniform", "safety", "hi-vis", "workwear"], reason: "Protective clothing & PPE — allowable for CT", legislation: "s.81 TCA 1997" },
  // Tools & small equipment (revenue expensed)
  { keywords: ["small tools", "hand tools", "consumable tools"], reason: "Small tools — allowable for CT (below capitalisation threshold)", legislation: "s.81 TCA 1997" },
];

/** Always non-deductible (add-backs to trading profit) */
const NON_DEDUCTIBLE_KEYWORDS: { keywords: string[]; reason: string; legislation?: string }[] = [
  // Entertainment
  { keywords: ["entertainment", "client entertainment", "client dinner", "client lunch", "hospitality"], reason: "Entertainment of clients/suppliers — not allowable for CT", legislation: "s.840 TCA 1997" },
  // Fines & Penalties
  { keywords: ["fine", "penalty", "penalties", "parking fine", "speeding", "late filing", "surcharge"], reason: "Fines & penalties — not allowable for CT", legislation: "Case law — not 'for the purposes of the trade'" },
  // Personal
  { keywords: ["personal", "private", "non-business", "groceries", "clothing"], reason: "Personal / non-business expense — not allowable for CT", legislation: "s.81(2)(a) TCA 1997 — not wholly and exclusively" },
  // Depreciation (use capital allowances instead)
  { keywords: ["depreciation", "amortisation", "amortization"], reason: "Depreciation — not deductible, claim capital allowances instead", legislation: "s.81(2)(f) TCA 1997" },
  // Dividends
  { keywords: ["dividend", "distribution", "profit distribution"], reason: "Dividends — appropriation of profit, not a deductible expense", legislation: "s.130 TCA 1997" },
  // Corporation tax itself
  { keywords: ["corporation tax", "ct payment", "tax payment"], reason: "Corporation tax — not a deductible expense", legislation: "s.81(2)(b) TCA 1997" },
  // General bad debt provisions
  { keywords: ["bad debt provision", "general provision", "doubtful debt provision"], reason: "General bad debt provisions — not allowable (only specific debts)", legislation: "s.81 TCA 1997" },
  // Capital expenditure (should be capital allowances)
  { keywords: ["capital expenditure", "capex"], reason: "Capital expenditure — not a direct deduction, may qualify for capital allowances", legislation: "s.81(2)(f) TCA 1997" },
];

/** Capital items — not P&L deductible but eligible for capital allowances */
const CAPITAL_KEYWORDS: { keywords: string[]; reason: string; legislation?: string }[] = [
  { keywords: ["computer equipment", "laptop", "server", "it equipment"], reason: "Capital: IT equipment — claim 12.5% over 8 years", legislation: "s.284 TCA 1997" },
  { keywords: ["machinery", "plant", "plant & machinery"], reason: "Capital: plant & machinery — claim 12.5% over 8 years", legislation: "s.284 TCA 1997" },
  { keywords: ["vehicle", "van", "car", "truck", "motor vehicle purchase"], reason: "Capital: motor vehicle — claim 12.5% over 8 years (max €24,000 for cars)", legislation: "s.284 & s.380K TCA 1997" },
  { keywords: ["fixture", "fitting", "furniture", "office furniture"], reason: "Capital: fixtures & fittings — claim 12.5% over 8 years", legislation: "s.284 TCA 1997" },
  { keywords: ["building", "premises purchase", "property purchase"], reason: "Capital: industrial building — claim 4% over 25 years", legislation: "s.268 TCA 1997" },
];

/** Description-level patterns (catch things category names might miss) */
const DESCRIPTION_NON_DEDUCTIBLE_PATTERNS: RegExp[] = [
  /\b(revenue commissioners?|collector.?general)\b/i,
  /\b(speeding|parking)\s+(fine|ticket)\b/i,
  /\b(late\s+filing|late\s+payment)\s+(penalty|surcharge|fee)\b/i,
];

const DESCRIPTION_CAPITAL_PATTERNS: RegExp[] = [
  /\b(purchased?|acquisition|bought)\b.*\b(vehicle|van|car|truck|laptop|server|machinery)\b/i,
];

// ── SPECIAL CASES ──────────────────────────────────────────────────────────

/** Staff entertainment is a special case — Christmas party / staff events ARE deductible */
function isStaffEntertainment(catLower: string, descLower: string): boolean {
  const isStaff = descLower.includes("staff") || descLower.includes("employee") ||
    descLower.includes("team") || descLower.includes("christmas party") ||
    catLower.includes("staff");
  const isEntertainment = catLower.includes("entertainment") || catLower.includes("meals") ||
    descLower.includes("dinner") || descLower.includes("lunch") || descLower.includes("party");
  return isStaff && isEntertainment;
}

/** Charitable donations — 80% deductible if ≥€250 to approved body */
function isCharitableDonation(catLower: string, descLower: string): boolean {
  return catLower.includes("donation") || catLower.includes("charit") ||
    descLower.includes("donation") || descLower.includes("charity");
}

/** Pre-trading expenses — up to 3 years before commencement, deductible in first year */
function isPreTradingExpense(catLower: string, descLower: string): boolean {
  return catLower.includes("pre-trading") || catLower.includes("pre trading") ||
    catLower.includes("setup cost") || catLower.includes("formation");
}

// ── MAIN CLASSIFIER ────────────────────────────────────────────────────────

function matchKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

export function isCTDeductible(
  description: string,
  categoryName?: string | null,
): CTDeductibilityResult {
  const catLower = (categoryName || "").toLowerCase();
  const descLower = (description || "").toLowerCase();

  // ── 0. Uncategorised → needs review (never assume) ──
  if (!categoryName || catLower === "uncategorised" || catLower === "uncategorized") {
    return {
      isDeductible: false,
      classification: "needs_review",
      reason: "Uncategorised — needs review before CT classification",
    };
  }

  // ── 1. Staff entertainment exception (deductible) ──
  if (isStaffEntertainment(catLower, descLower)) {
    return {
      isDeductible: true,
      classification: "deductible",
      reason: "Staff entertainment — allowable for CT (staff events, not client entertainment)",
      legislation: "Revenue concession — staff welfare",
    };
  }

  // ── 2. Check non-deductible keywords ──
  for (const rule of NON_DEDUCTIBLE_KEYWORDS) {
    if (matchKeywords(catLower, rule.keywords) || matchKeywords(descLower, rule.keywords)) {
      return {
        isDeductible: false,
        classification: "non_deductible",
        reason: rule.reason,
        legislation: rule.legislation,
      };
    }
  }

  // ── 3. Check description-level non-deductible patterns ──
  for (const pattern of DESCRIPTION_NON_DEDUCTIBLE_PATTERNS) {
    if (pattern.test(description) || pattern.test(descLower)) {
      return {
        isDeductible: false,
        classification: "non_deductible",
        reason: "Tax payment / penalty to Revenue — not deductible for CT",
        legislation: "s.81(2)(b) TCA 1997",
      };
    }
  }

  // ── 4. Capital items (not P&L deductible, but capital allowances) ──
  for (const rule of CAPITAL_KEYWORDS) {
    if (matchKeywords(catLower, rule.keywords)) {
      return {
        isDeductible: false,
        classification: "capital",
        reason: rule.reason,
        legislation: rule.legislation,
      };
    }
  }
  for (const pattern of DESCRIPTION_CAPITAL_PATTERNS) {
    if (pattern.test(description)) {
      return {
        isDeductible: false,
        classification: "capital",
        reason: "Capital expenditure detected — not a direct deduction, claim capital allowances",
        legislation: "s.284 TCA 1997",
      };
    }
  }

  // ── 5. Special cases ──
  if (isCharitableDonation(catLower, descLower)) {
    return {
      isDeductible: true,
      classification: "deductible",
      reason: "Charitable donation — 80% deductible if ≥€250 to an approved body (s.848A TCA 1997)",
      legislation: "s.848A TCA 1997",
    };
  }

  if (isPreTradingExpense(catLower, descLower)) {
    return {
      isDeductible: true,
      classification: "deductible",
      reason: "Pre-trading expense — deductible if incurred within 3 years before trade commenced",
      legislation: "s.82 TCA 1997",
    };
  }

  // ── 6. Check deductible keywords ──
  for (const rule of DEDUCTIBLE_KEYWORDS) {
    if (matchKeywords(catLower, rule.keywords) || matchKeywords(descLower, rule.keywords)) {
      return {
        isDeductible: true,
        classification: "deductible",
        reason: rule.reason,
        legislation: rule.legislation,
      };
    }
  }

  // ── 7. Default: deductible (known category, not in non-deductible list) ──
  // If we have a category name and it's not in any exclusion list, it's likely
  // a business expense. Conservative approach: still mark as deductible but
  // with a generic reason.
  return {
    isDeductible: true,
    classification: "deductible",
    reason: "Allowable business expense for CT — wholly and exclusively for the trade",
    legislation: "s.81 TCA 1997",
  };
}
