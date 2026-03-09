/**
 * Mock RPN (Revenue Payroll Notification) data generator for demo purposes.
 * Generates realistic Irish tax data based on PPSN hash — same PPSN always
 * returns the same data, simulating a real Revenue lookup.
 */

export interface MockRPNResult {
  rpnNumber: string;
  taxCreditsYearly: number;
  standardRateCutOffYearly: number;
  uscStatus: "ordinary" | "reduced" | "exempt";
  prsiClass: string;
  previousPay: number;
  previousTax: number;
  previousUSC: number;
  previousPRSI: number;
  effectiveDate: string;
}

/** Simple deterministic hash from a string to a number 0-1 */
function hashPPSN(ppsn: string): number {
  let hash = 0;
  for (let i = 0; i < ppsn.length; i++) {
    hash = (hash << 5) - hash + ppsn.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

/** Pick from array using hash offset */
function pick<T>(arr: T[], hash: number, offset: number): T {
  const idx = Math.floor(((hash * 1000 + offset) % 1) * arr.length) || 0;
  return arr[Math.abs(idx) % arr.length];
}

export function generateMockRPN(ppsn: string): MockRPNResult {
  const h = hashPPSN(ppsn.toUpperCase().trim());

  // Tax credits: realistic Irish 2026 values
  const creditProfiles = [
    { credits: 4000, label: "Single + PAYE" },           // Single person €1875 + PAYE €1875 + rounding
    { credits: 3750, label: "Single + PAYE" },
    { credits: 7500, label: "Married one earner" },       // Married €3750 + PAYE €1875 + Home Carer
    { credits: 5625, label: "Married two earners" },
    { credits: 4950, label: "Single + PAYE + Flat rate" },
    { credits: 3400, label: "Single reduced" },
  ];

  // Standard rate cut-off
  const cutOffProfiles = [44000, 44000, 88000, 53000, 44000, 40000];

  // USC status distribution
  const uscStatuses: ("ordinary" | "reduced" | "exempt")[] = [
    "ordinary", "ordinary", "ordinary", "ordinary", "reduced", "exempt",
  ];

  // PRSI class distribution
  const prsiClasses = ["A1", "A1", "A1", "A1", "A8", "S"];

  const idx = Math.floor(h * creditProfiles.length);
  const profile = creditProfiles[idx % creditProfiles.length];
  const cutOff = cutOffProfiles[idx % cutOffProfiles.length];
  const uscStatus = uscStatuses[idx % uscStatuses.length];
  const prsiClass = prsiClasses[idx % prsiClasses.length];

  // Previous pay/tax (simulate partial year — we're in March 2026, ~2 months of pay)
  const annualSalaryGuess = 35000 + Math.floor(h * 80000); // €35k-€115k range
  const monthsWorked = 2; // Jan + Feb 2026
  const previousPay = Math.round((annualSalaryGuess / 12) * monthsWorked * 100) / 100;
  const effectiveTaxRate = cutOff >= 88000 ? 0.2 : 0.28;
  const previousTax = Math.round(previousPay * effectiveTaxRate * 0.5 * 100) / 100; // After credits
  const previousUSC = Math.round(previousPay * 0.04 * 100) / 100;
  const previousPRSI = Math.round(previousPay * 0.04 * 100) / 100;

  // Generate a realistic RPN number: RPN-YYYY-NNNNNNN
  const rpnSeq = String(Math.floor(h * 9000000) + 1000000);
  const rpnNumber = `RPN-2026-${rpnSeq}`;

  return {
    rpnNumber,
    taxCreditsYearly: profile.credits,
    standardRateCutOffYearly: cutOff,
    uscStatus,
    prsiClass,
    previousPay,
    previousTax,
    previousUSC,
    previousPRSI,
    effectiveDate: "2026-01-01",
  };
}
