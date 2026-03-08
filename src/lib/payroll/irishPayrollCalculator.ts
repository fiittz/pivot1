// 2026 Irish tax tables — update annually after Finance Act
export const TAX_TABLES_2026 = {
  incomeTax: {
    standardRate: 0.20,
    higherRate: 0.40,
    standardRateBand: {
      single: 44000,
      married_one_income: 53000,
      married_two_incomes: 88000, // 53000 + 35000
    },
  },
  usc: {
    exemptionThreshold: 13000,
    bands: [
      { from: 0, to: 12012, rate: 0.005 },
      { from: 12012, to: 27742, rate: 0.02 },
      { from: 27742, to: 70044, rate: 0.03 },
      { from: 70044, to: Infinity, rate: 0.08 },
    ],
    selfEmployedSurcharge: {
      threshold: 100000,
      rate: 0.03,
    },
  },
  prsi: {
    classA1: {
      employee: {
        rate: 0.042,
        weeklyExemption: 352, // No PRSI if weekly pay <= €352
        credit: { threshold: 424, maxCredit: 12 }, // PRSI credit for low earners
      },
      employer: {
        lowerRate: 0.09,
        higherRate: 0.1125,
        weeklyThreshold: 552, // Higher rate kicks in above this
      },
    },
    classS: {
      rate: 0.042,
      minimumContribution: 650, // per year
    },
  },
  defaultCredits: {
    personalCreditSingle: 2000,
    personalCreditMarried: 4000,
    employeeTaxCredit: 2000,
    earnedIncomeCredit: 2000, // for self-employed/directors
  },
  autoEnrolment: {
    pensionableCap: 80000,        // max earnings for contributions
    minimumEarnings: 20000,       // annual threshold to trigger enrolment
    minimumAge: 23,
    maximumAge: 60,
    phases: [
      { from: 2026, to: 2028, employee: 0.015, employer: 0.015, state: 0.005 },
      { from: 2029, to: 2031, employee: 0.03, employer: 0.03, state: 0.01 },
      { from: 2032, to: 2034, employee: 0.045, employer: 0.045, state: 0.015 },
      { from: 2035, to: Infinity, employee: 0.06, employer: 0.06, state: 0.02 },
    ],
  },
};

export type TaxTables = typeof TAX_TABLES_2026;

export interface PayrollInput {
  grossPay: number;
  overtime: number;
  bonus: number;
  benefitInKind: number;
  // Employee tax details (from RPN or manual)
  yearlyTaxCredits: number;
  yearlyStandardRateCutOff: number;
  uscStatus: "ordinary" | "reduced" | "exempt";
  prsiClass: string;
  // Pension
  pensionEmployeePct: number;
  pensionEmployerPct: number;
  // Pay period info
  payFrequency: "weekly" | "fortnightly" | "monthly";
  payPeriod: number; // 1-52 for weekly, 1-26 for fortnightly, 1-12 for monthly
  // Cumulative from previous periods
  previousCumulativeGross: number;
  previousCumulativeTax: number;
  previousCumulativeUSC: number;
  previousCumulativePRSI: number;
  // Is director (affects PRSI class)
  isDirector: boolean;
  // Auto-enrolment (MyFutureFund)
  autoEnrolment?: {
    age: number;
    annualGross: number;
    taxYear: number;
    hasQualifyingPension: boolean;
    optedOut: boolean;
    suspendedContributions: boolean;
  };
}

export interface PayrollResult {
  // This period
  grossPay: number;
  taxableGross: number; // gross + overtime + bonus + BIK
  paye: number;
  usc: number;
  employeePrsi: number;
  pensionEmployee: number;
  totalDeductions: number;
  netPay: number;
  // Employer costs
  employerPrsi: number;
  pensionEmployer: number;
  totalEmployerCost: number; // gross + employer PRSI + employer pension
  // Cumulative
  cumulativeGross: number;
  cumulativeTax: number;
  cumulativeUSC: number;
  cumulativePRSI: number;
  // Breakdown for display
  payeBreakdown: {
    grossTaxAtStandard: number;
    grossTaxAtHigher: number;
    grossTax: number;
    cumulativeCredits: number;
    cumulativeTaxDue: number;
    taxThisPeriod: number;
  };
  uscBreakdown: {
    bands: { from: number; to: number; rate: number; amount: number }[];
    totalUSCDue: number;
    uscThisPeriod: number;
  };
  // Auto-enrolment (MyFutureFund) — only present when auto-enrolment input is provided
  autoEnrolment?: AutoEnrolmentResult;
}

function getPeriodsPerYear(freq: "weekly" | "fortnightly" | "monthly"): number {
  if (freq === "weekly") return 52;
  if (freq === "fortnightly") return 26;
  return 12;
}

// --- MyFutureFund Auto-Enrolment ---

export interface AutoEnrolmentEligibility {
  age: number;
  annualGross: number;
  hasQualifyingPension: boolean;
  optedOut?: boolean;
}

export interface AutoEnrolmentEligibilityResult {
  eligible: boolean;
  reason?: string;
}

export function isEligibleForAutoEnrolment(
  params: AutoEnrolmentEligibility,
  tables: TaxTables = TAX_TABLES_2026,
): AutoEnrolmentEligibilityResult {
  const ae = tables.autoEnrolment;

  if (params.optedOut) {
    return { eligible: false, reason: "Employee has opted out of auto-enrolment" };
  }
  if (params.hasQualifyingPension) {
    return { eligible: false, reason: "Employee already has a qualifying pension scheme" };
  }
  if (params.age < ae.minimumAge) {
    return { eligible: false, reason: `Employee is under the minimum age of ${ae.minimumAge}` };
  }
  if (params.age > ae.maximumAge) {
    return { eligible: false, reason: `Employee is over the maximum age of ${ae.maximumAge}` };
  }
  if (params.annualGross < ae.minimumEarnings) {
    return { eligible: false, reason: `Annual gross earnings (€${params.annualGross.toFixed(2)}) are below the minimum threshold of €${ae.minimumEarnings}` };
  }

  return { eligible: true };
}

export interface AutoEnrolmentInput {
  grossPay: number;           // period gross pay
  annualGross: number;        // for eligibility check
  taxYear: number;            // to determine phase rates
  frequency: "monthly" | "fortnightly" | "weekly";
  age: number;
  hasQualifyingPension: boolean;
  optedOut: boolean;
  suspendedContributions: boolean;
}

export interface AutoEnrolmentResult {
  eligible: boolean;
  employeeContribution: number;   // deducted from NET pay
  employerContribution: number;   // additional employer cost
  stateTopUp: number;             // not deducted, just informational
  totalContribution: number;
  pensionableEarnings: number;    // gross capped at €80k prorated
  rates: { employee: number; employer: number; state: number };
}

function getAutoEnrolmentRates(
  taxYear: number,
  tables: TaxTables = TAX_TABLES_2026,
): { employee: number; employer: number; state: number } {
  const phase = tables.autoEnrolment.phases.find(
    (p) => taxYear >= p.from && taxYear <= p.to,
  );
  // Fallback to final phase if no match (shouldn't happen with Infinity)
  const fallback = tables.autoEnrolment.phases[tables.autoEnrolment.phases.length - 1];
  const chosen = phase ?? fallback;
  return { employee: chosen.employee, employer: chosen.employer, state: chosen.state };
}

export function calculateAutoEnrolmentContributions(
  params: AutoEnrolmentInput,
  tables: TaxTables = TAX_TABLES_2026,
): AutoEnrolmentResult {
  const zeroResult: AutoEnrolmentResult = {
    eligible: false,
    employeeContribution: 0,
    employerContribution: 0,
    stateTopUp: 0,
    totalContribution: 0,
    pensionableEarnings: 0,
    rates: { employee: 0, employer: 0, state: 0 },
  };

  // Check eligibility
  const eligibility = isEligibleForAutoEnrolment({
    age: params.age,
    annualGross: params.annualGross,
    hasQualifyingPension: params.hasQualifyingPension,
    optedOut: params.optedOut,
  }, tables);

  if (!eligibility.eligible) return zeroResult;

  // Contributions suspended (e.g. during a savings suspension period)
  if (params.suspendedContributions) {
    return { ...zeroResult, eligible: true };
  }

  const rates = getAutoEnrolmentRates(params.taxYear, tables);
  const periodsPerYear = getPeriodsPerYear(params.frequency);

  // Cap pensionable earnings at €80k prorated to the pay period
  const annualCap = tables.autoEnrolment.pensionableCap;
  const periodCap = round2(annualCap / periodsPerYear);
  const pensionableEarnings = Math.min(params.grossPay, periodCap);

  const employeeContribution = round2(pensionableEarnings * rates.employee);
  const employerContribution = round2(pensionableEarnings * rates.employer);
  const stateTopUp = round2(pensionableEarnings * rates.state);

  return {
    eligible: true,
    employeeContribution,
    employerContribution,
    stateTopUp,
    totalContribution: round2(employeeContribution + employerContribution + stateTopUp),
    pensionableEarnings,
    rates,
  };
}

// Generate journal lines for auto-enrolment contributions
export function generateAutoEnrolmentJournalLines(
  totalEmployerContribution: number,
  totalEmployeeContribution: number,
): JournalLine[] {
  const lines: JournalLine[] = [];
  const totalLiability = round2(totalEmployerContribution + totalEmployeeContribution);

  if (totalLiability <= 0) return lines;

  // Debit: Employer Pension Contribution (expense) — employer portion
  if (totalEmployerContribution > 0) {
    lines.push({
      accountName: "Employer MyFutureFund Contribution",
      accountType: "Payroll",
      accountCode: "6740",
      debit: round2(totalEmployerContribution),
      credit: 0,
    });
  }

  // Credit: MyFutureFund Liability (current liability) — total employer + employee
  lines.push({
    accountName: "MyFutureFund Liability",
    accountType: "Current Liabilities",
    accountCode: "2225",
    debit: 0,
    credit: totalLiability,
  });

  return lines;
}

export function calculatePayroll(input: PayrollInput, tables: TaxTables = TAX_TABLES_2026): PayrollResult {
  const periodsPerYear = getPeriodsPerYear(input.payFrequency);
  const taxableGross = input.grossPay + input.overtime + input.bonus + input.benefitInKind;

  // Pension (deducted before tax for employee contribution — relief at source)
  const pensionEmployee = Math.round((taxableGross * input.pensionEmployeePct / 100) * 100) / 100;
  const pensionEmployer = Math.round((taxableGross * input.pensionEmployerPct / 100) * 100) / 100;

  // Taxable pay after pension relief
  const taxablePay = taxableGross - pensionEmployee;

  // --- PAYE (Cumulative Basis) ---
  const cumulativeGross = input.previousCumulativeGross + taxablePay;
  const cumulativeCutOff = (input.yearlyStandardRateCutOff / periodsPerYear) * input.payPeriod;
  const cumulativeCredits = (input.yearlyTaxCredits / periodsPerYear) * input.payPeriod;

  const atStandardRate = Math.min(cumulativeGross, cumulativeCutOff);
  const atHigherRate = Math.max(0, cumulativeGross - cumulativeCutOff);

  const grossTaxAtStandard = atStandardRate * tables.incomeTax.standardRate;
  const grossTaxAtHigher = atHigherRate * tables.incomeTax.higherRate;
  const grossTax = grossTaxAtStandard + grossTaxAtHigher;

  const cumulativeTaxDue = Math.max(0, grossTax - cumulativeCredits);
  const payeThisPeriod = Math.max(0, Math.round((cumulativeTaxDue - input.previousCumulativeTax) * 100) / 100);

  // --- USC (Cumulative Basis) ---
  let uscThisPeriod = 0;
  const uscBreakdownBands: { from: number; to: number; rate: number; amount: number }[] = [];

  if (input.uscStatus === "exempt") {
    uscThisPeriod = 0;
  } else {
    // Apply cumulative USC
    const cumulativeGrossForUSC = input.previousCumulativeGross + taxableGross; // USC on full gross (before pension)
    let totalUSC = 0;

    const bands = input.uscStatus === "reduced"
      ? [
          { from: 0, to: 12012, rate: 0.005 },
          { from: 12012, to: Infinity, rate: 0.02 },
        ]
      : tables.usc.bands;

    for (const band of bands) {
      const bandWidth = band.to === Infinity ? cumulativeGrossForUSC : (band.to - band.from);
      const applicableAmount = Math.min(Math.max(0, cumulativeGrossForUSC - band.from), bandWidth);

      if (applicableAmount > 0) {
        const uscForBand = applicableAmount * band.rate;
        totalUSC += uscForBand;
        uscBreakdownBands.push({
          from: band.from,
          to: band.to === Infinity ? cumulativeGrossForUSC : band.to,
          rate: band.rate,
          amount: Math.round(uscForBand * 100) / 100,
        });
      }
    }

    uscThisPeriod = Math.max(0, Math.round((totalUSC - input.previousCumulativeUSC) * 100) / 100);
  }

  // --- Employee PRSI ---
  let employeePrsi = 0;
  const weeklyEquivalent = taxableGross * (input.payFrequency === "weekly" ? 1 : input.payFrequency === "fortnightly" ? 0.5 : 12 / 52);

  if (input.prsiClass === "A1" || input.prsiClass === "A2") {
    if (weeklyEquivalent > tables.prsi.classA1.employee.weeklyExemption) {
      employeePrsi = Math.round(taxableGross * tables.prsi.classA1.employee.rate * 100) / 100;
      // Apply PRSI credit for low earners
      if (weeklyEquivalent <= tables.prsi.classA1.employee.credit.threshold) {
        const credit = Math.min(tables.prsi.classA1.employee.credit.maxCredit, employeePrsi);
        employeePrsi = Math.max(0, employeePrsi - credit);
      }
    }
  } else if (input.prsiClass === "S") {
    employeePrsi = Math.round(taxableGross * tables.prsi.classS.rate * 100) / 100;
  }

  // --- Employer PRSI ---
  let employerPrsi = 0;
  if (input.prsiClass === "A1" || input.prsiClass === "A2") {
    const rate = weeklyEquivalent > tables.prsi.classA1.employer.weeklyThreshold
      ? tables.prsi.classA1.employer.higherRate
      : tables.prsi.classA1.employer.lowerRate;
    employerPrsi = Math.round(taxableGross * rate * 100) / 100;
  }
  // Class S = self-employed, no employer PRSI

  // --- Auto-Enrolment (MyFutureFund) ---
  let autoEnrolmentResult: AutoEnrolmentResult | undefined;
  if (input.autoEnrolment) {
    autoEnrolmentResult = calculateAutoEnrolmentContributions({
      grossPay: taxableGross,
      annualGross: input.autoEnrolment.annualGross,
      taxYear: input.autoEnrolment.taxYear,
      frequency: input.payFrequency,
      age: input.autoEnrolment.age,
      hasQualifyingPension: input.autoEnrolment.hasQualifyingPension,
      optedOut: input.autoEnrolment.optedOut,
      suspendedContributions: input.autoEnrolment.suspendedContributions,
    }, tables);
  }

  const aeEmployeeDeduction = autoEnrolmentResult?.employeeContribution ?? 0;
  const aeEmployerCost = autoEnrolmentResult?.employerContribution ?? 0;

  // --- Totals ---
  // Auto-enrolment employee contribution is a post-tax deduction (does NOT reduce PAYE/USC/PRSI)
  const totalDeductions = payeThisPeriod + uscThisPeriod + employeePrsi + pensionEmployee + aeEmployeeDeduction;
  const netPay = Math.round((taxableGross - totalDeductions) * 100) / 100;
  const totalEmployerCost = Math.round((taxableGross + employerPrsi + pensionEmployer + aeEmployerCost) * 100) / 100;

  return {
    grossPay: taxableGross,
    taxableGross,
    paye: payeThisPeriod,
    usc: uscThisPeriod,
    employeePrsi,
    pensionEmployee,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay,
    employerPrsi,
    pensionEmployer,
    totalEmployerCost,
    cumulativeGross: cumulativeGross,
    cumulativeTax: input.previousCumulativeTax + payeThisPeriod,
    cumulativeUSC: input.previousCumulativeUSC + uscThisPeriod,
    cumulativePRSI: input.previousCumulativePRSI + employeePrsi,
    payeBreakdown: {
      grossTaxAtStandard,
      grossTaxAtHigher,
      grossTax,
      cumulativeCredits,
      cumulativeTaxDue,
      taxThisPeriod: payeThisPeriod,
    },
    uscBreakdown: {
      bands: uscBreakdownBands,
      totalUSCDue: input.previousCumulativeUSC + uscThisPeriod,
      uscThisPeriod,
    },
    autoEnrolment: autoEnrolmentResult,
  };
}

// --- Dividend DWT Calculation ---
export interface DividendInput {
  grossAmount: number;
  dwtRate?: number; // default 25%
}

export interface DividendResult {
  grossAmount: number;
  dwtRate: number;
  dwtAmount: number;
  netAmount: number;
  dwtDueDate: string; // 14th of month following payment
}

export function calculateDividend(input: DividendInput): DividendResult {
  const dwtRate = input.dwtRate ?? 25;
  const dwtAmount = Math.round(input.grossAmount * dwtRate / 100 * 100) / 100;
  const netAmount = Math.round((input.grossAmount - dwtAmount) * 100) / 100;

  return {
    grossAmount: input.grossAmount,
    dwtRate,
    dwtAmount,
    netAmount,
    dwtDueDate: "", // will be set by the caller based on payment date
  };
}

// Helper: get DWT due date (14th of month following payment)
export function getDWTDueDate(paymentDate: Date): Date {
  const month = paymentDate.getMonth() + 1; // next month
  const year = paymentDate.getFullYear() + (month > 11 ? 1 : 0);
  return new Date(year, month % 12, 14);
}

// Helper: generate payroll journal entry lines
export interface JournalLine {
  accountName: string;
  accountType: string;
  accountCode: string;
  debit: number;
  credit: number;
}

export function generatePayrollJournalLines(results: { employeeName: string; result: PayrollResult }[]): JournalLine[] {
  let totalGross = 0;
  let totalEmployerPrsi = 0;
  let totalEmployerPension = 0;
  let totalPaye = 0;
  let totalUsc = 0;
  let totalEmployeePrsi = 0;
  let totalPensionEmployee = 0;
  let totalNetPay = 0;
  let totalAEEmployer = 0;
  let totalAEEmployee = 0;

  for (const { result } of results) {
    totalGross += result.grossPay;
    totalEmployerPrsi += result.employerPrsi;
    totalEmployerPension += result.pensionEmployer;
    totalPaye += result.paye;
    totalUsc += result.usc;
    totalEmployeePrsi += result.employeePrsi;
    totalPensionEmployee += result.pensionEmployee;
    totalNetPay += result.netPay;
    if (result.autoEnrolment) {
      totalAEEmployer += result.autoEnrolment.employerContribution;
      totalAEEmployee += result.autoEnrolment.employeeContribution;
    }
  }

  const lines: JournalLine[] = [];

  // Debits (expenses)
  if (totalGross > 0) lines.push({ accountName: "Wages & Salaries", accountType: "Payroll", accountCode: "6700", debit: round2(totalGross), credit: 0 });
  if (totalEmployerPrsi > 0) lines.push({ accountName: "Employer PRSI", accountType: "Payroll", accountCode: "6720", debit: round2(totalEmployerPrsi), credit: 0 });
  if (totalEmployerPension > 0) lines.push({ accountName: "Employer Pension", accountType: "Payroll", accountCode: "6730", debit: round2(totalEmployerPension), credit: 0 });

  // Credits (liabilities)
  if (totalPaye > 0) lines.push({ accountName: "PAYE Liability", accountType: "Current Liabilities", accountCode: "2210", debit: 0, credit: round2(totalPaye) });
  if (totalUsc > 0) lines.push({ accountName: "USC Liability", accountType: "Current Liabilities", accountCode: "2211", debit: 0, credit: round2(totalUsc) });
  if (totalEmployeePrsi + totalEmployerPrsi > 0) lines.push({ accountName: "PRSI Liability", accountType: "Current Liabilities", accountCode: "2212", debit: 0, credit: round2(totalEmployeePrsi + totalEmployerPrsi) });
  if (totalPensionEmployee + totalEmployerPension > 0) lines.push({ accountName: "Pension Liability", accountType: "Current Liabilities", accountCode: "2220", debit: 0, credit: round2(totalPensionEmployee + totalEmployerPension) });

  // Auto-enrolment (MyFutureFund) journal lines
  if (totalAEEmployer + totalAEEmployee > 0) {
    const aeLines = generateAutoEnrolmentJournalLines(totalAEEmployer, totalAEEmployee);
    lines.push(...aeLines);
  }

  if (totalNetPay > 0) lines.push({ accountName: "Net Pay Control", accountType: "Current Liabilities", accountCode: "2200", debit: 0, credit: round2(totalNetPay) });

  return lines;
}

export function generateDividendJournalLines(dividend: DividendResult, recipientName: string): JournalLine[] {
  const lines: JournalLine[] = [];

  lines.push({ accountName: `Dividends Paid - ${recipientName}`, accountType: "Equity", accountCode: "3200", debit: round2(dividend.grossAmount), credit: 0 });
  if (dividend.dwtAmount > 0) lines.push({ accountName: "DWT Liability", accountType: "Current Liabilities", accountCode: "2230", debit: 0, credit: round2(dividend.dwtAmount) });
  lines.push({ accountName: "Bank", accountType: "bank", accountCode: "1200", debit: 0, credit: round2(dividend.netAmount) });

  return lines;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
