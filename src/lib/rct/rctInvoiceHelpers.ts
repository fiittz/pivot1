// ---------------------------------------------------------------------------
// RCT Invoice Calculation Helpers
// Pure functions — no side effects, no API calls.
// ---------------------------------------------------------------------------

/**
 * Round a number to 2 decimal places using banker's-safe rounding.
 */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// 1. calculateRCTDeduction
// ---------------------------------------------------------------------------

export interface RCTDeductionResult {
  gross: number;
  rctAmount: number;
  netPayable: number;
  rctRate: number;
}

/**
 * Calculate the RCT deduction for a given gross amount and rate.
 *
 * @param grossAmount - The gross payment amount before deduction.
 * @param rctRate     - The RCT rate as a percentage (0, 20, or 35).
 */
export function calculateRCTDeduction(
  grossAmount: number,
  rctRate: number
): RCTDeductionResult {
  const rctAmount = round2(grossAmount * (rctRate / 100));
  const netPayable = round2(grossAmount - rctAmount);

  return {
    gross: round2(grossAmount),
    rctAmount,
    netPayable,
    rctRate,
  };
}

// ---------------------------------------------------------------------------
// 2. isRCTApplicable
// ---------------------------------------------------------------------------

/**
 * Determine whether RCT applies to a given invoice.
 */
export function isRCTApplicable(invoice: { is_rct?: boolean }): boolean {
  return invoice.is_rct === true;
}

// ---------------------------------------------------------------------------
// 3. getRCTRateLabel
// ---------------------------------------------------------------------------

/**
 * Return a human-readable label for an RCT rate.
 */
export function getRCTRateLabel(rate: number): string {
  switch (rate) {
    case 0:
      return "0% - Relevant";
    case 20:
      return "20% - Standard";
    case 35:
      return "35% - Unregistered/Non-compliant";
    default:
      return `${rate}% - Custom`;
  }
}

// ---------------------------------------------------------------------------
// 4. formatRCTDeductionRef
// ---------------------------------------------------------------------------

/**
 * Format an RCT deduction reference for display.
 *
 * Ensures consistent formatting: uppercase, trimmed, and grouped with dashes
 * if the ref is a plain alphanumeric string.
 */
export function formatRCTDeductionRef(ref: string): string {
  const trimmed = ref.trim().toUpperCase();

  // If it already contains separators, return as-is (already formatted).
  if (trimmed.includes("-") || trimmed.includes("/")) {
    return trimmed;
  }

  // Group into blocks of 4 for readability (e.g. "ABCD-1234-EFGH").
  return trimmed.match(/.{1,4}/g)?.join("-") ?? trimmed;
}

// ---------------------------------------------------------------------------
// 5. getRCTReturnPeriod
// ---------------------------------------------------------------------------

export interface RCTReturnPeriod {
  month: number;
  year: number;
}

/**
 * Determine the RCT return period for a given date.
 * RCT returns are filed monthly.
 */
export function getRCTReturnPeriod(date: Date): RCTReturnPeriod {
  return {
    month: date.getMonth() + 1, // 1-indexed
    year: date.getFullYear(),
  };
}

// ---------------------------------------------------------------------------
// 6. isReverseChargeVAT
// ---------------------------------------------------------------------------

/**
 * Check whether the reverse charge VAT mechanism applies.
 *
 * In Ireland, construction services under RCT use the VAT reverse charge —
 * the principal (rather than the subcontractor) accounts for the VAT.
 */
export function isReverseChargeVAT(invoice: {
  is_rct?: boolean;
  is_reverse_charge_vat?: boolean;
}): boolean {
  return invoice.is_rct === true && invoice.is_reverse_charge_vat === true;
}

// ---------------------------------------------------------------------------
// 7. calculateRCTInvoiceTotal
// ---------------------------------------------------------------------------

export interface RCTInvoiceTotalResult {
  gross: number;
  vat: number;
  rctDeduction: number;
  netPayable: number;
}

/**
 * Calculate the full invoice total under RCT, optionally with reverse-charge
 * VAT.
 *
 * When reverse charge applies the subcontractor does NOT charge VAT on the
 * invoice — the principal self-accounts for it. So:
 *   - Reverse charge: VAT = 0 on the invoice, RCT deducted from gross.
 *   - Normal:         VAT is added to gross, RCT deducted from gross only
 *                     (not from the VAT portion).
 *
 * @param grossAmount    - The net/goods amount before VAT.
 * @param vatRate        - VAT rate as a percentage (e.g. 13.5 for construction).
 * @param rctRate        - RCT rate as a percentage (0, 20, or 35).
 * @param isReverseCharge - Whether the reverse charge mechanism applies.
 */
export function calculateRCTInvoiceTotal(
  grossAmount: number,
  vatRate: number,
  rctRate: number,
  isReverseCharge: boolean
): RCTInvoiceTotalResult {
  const gross = round2(grossAmount);
  const vat = isReverseCharge ? 0 : round2(gross * (vatRate / 100));
  const rctDeduction = round2(gross * (rctRate / 100));
  const netPayable = round2(gross + vat - rctDeduction);

  return {
    gross,
    vat,
    rctDeduction,
    netPayable,
  };
}
