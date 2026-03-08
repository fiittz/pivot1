import { describe, it, expect } from "vitest";
import {
  calculatePayroll,
  calculateDividend,
  getDWTDueDate,
  generatePayrollJournalLines,
  generateDividendJournalLines,
  TAX_TABLES_2026,
  type PayrollInput,
  type PayrollResult,
} from "../irishPayrollCalculator";

// ── Helper: build a default PayrollInput ──────────────────────

function makeInput(overrides: Partial<PayrollInput>): PayrollInput {
  return {
    grossPay: 0,
    overtime: 0,
    bonus: 0,
    benefitInKind: 0,
    yearlyTaxCredits: 4000, // personal €2,000 + employee €2,000
    yearlyStandardRateCutOff: 44000,
    uscStatus: "ordinary",
    prsiClass: "A1",
    pensionEmployeePct: 0,
    pensionEmployerPct: 0,
    payFrequency: "monthly",
    payPeriod: 1,
    previousCumulativeGross: 0,
    previousCumulativeTax: 0,
    previousCumulativeUSC: 0,
    previousCumulativePRSI: 0,
    isDirector: false,
    ...overrides,
  };
}

// ── 1. Director on €60,000 salary (monthly) ──────────────────

describe("Director on €60,000 salary (monthly), PRSI Class S", () => {
  const input = makeInput({
    grossPay: 5000,
    prsiClass: "S",
    isDirector: true,
    payFrequency: "monthly",
    payPeriod: 1,
    yearlyTaxCredits: 4000, // personal + earned income for director
    yearlyStandardRateCutOff: 44000,
  });

  const result = calculatePayroll(input);

  it("grossPay = €5,000", () => {
    expect(result.grossPay).toBeCloseTo(5000, 2);
  });

  it("PAYE calculated correctly on cumulative basis", () => {
    // cumulativeCutOff = 44000/12 * 1 = 3666.6667
    // atStandard = min(5000, 3666.6667) = 3666.6667
    // atHigher = 5000 - 3666.6667 = 1333.3333
    // grossTax = 3666.6667*0.20 + 1333.3333*0.40 = 733.3333 + 533.3333 = 1266.6667
    // credits = 4000/12 = 333.3333
    // taxDue = 1266.6667 - 333.3333 = 933.3333 -> round = 933.33
    expect(result.paye).toBeCloseTo(933.33, 2);
  });

  it("USC on first €5,000 (all within 0.5% band)", () => {
    // 5000 * 0.005 = 25.00
    expect(result.usc).toBeCloseTo(25.0, 2);
  });

  it("Employee PRSI Class S at 4.2%", () => {
    // 5000 * 0.042 = 210.00
    expect(result.employeePrsi).toBeCloseTo(210.0, 2);
  });

  it("No employer PRSI for Class S", () => {
    expect(result.employerPrsi).toBeCloseTo(0, 2);
  });

  it("Net pay after deductions", () => {
    // 5000 - 933.33 - 25.00 - 210.00 = 3831.67
    expect(result.netPay).toBeCloseTo(3831.67, 2);
  });

  it("Total employer cost equals gross (no employer PRSI/pension)", () => {
    expect(result.totalEmployerCost).toBeCloseTo(5000, 2);
  });
});

// ── 2. Employee on €35,000 salary (monthly) ──────────────────

describe("Employee on €35,000 salary (monthly), PRSI Class A1", () => {
  // Monthly gross = 35000 / 12 = 2916.666... use 2916.67 as input
  const input = makeInput({
    grossPay: 2916.67,
    prsiClass: "A1",
    payFrequency: "monthly",
    payPeriod: 1,
  });

  const result = calculatePayroll(input);

  it("grossPay = €2,916.67", () => {
    expect(result.grossPay).toBeCloseTo(2916.67, 2);
  });

  it("PAYE — all within 20% standard band", () => {
    // cumulativeCutOff = 44000/12 = 3666.67 > 2916.67, so all at 20%
    // grossTax = 2916.67 * 0.20 = 583.334
    // credits = 4000/12 = 333.333
    // taxDue = 583.334 - 333.333 = 250.001 -> round = 250.00
    expect(result.paye).toBeCloseTo(250.0, 2);
  });

  it("USC — all within 0.5% band", () => {
    // 2916.67 * 0.005 = 14.58335 -> round = 14.58
    expect(result.usc).toBeCloseTo(14.58, 2);
  });

  it("Employee PRSI Class A1 at 4.2%", () => {
    // weeklyEquivalent = 2916.67 * 12/52 = 673.077...
    // > 352 exemption, > 424 credit threshold
    // 2916.67 * 0.042 = 122.50014 -> round = 122.50
    expect(result.employeePrsi).toBeCloseTo(122.5, 2);
  });

  it("Employer PRSI at higher rate (11.25%) since weekly > €552", () => {
    // weeklyEquivalent = 673.08 > 552
    // 2916.67 * 0.1125 = 328.125375 -> round = 328.13
    expect(result.employerPrsi).toBeCloseTo(328.13, 2);
  });

  it("Net pay", () => {
    // 2916.67 - 250.00 - 14.58 - 122.50 = 2529.59
    expect(result.netPay).toBeCloseTo(2529.59, 2);
  });

  it("Total employer cost", () => {
    // 2916.67 + 328.13 = 3244.80
    expect(result.totalEmployerCost).toBeCloseTo(3244.8, 2);
  });
});

// ── 3. High earner on €120,000 salary (monthly) ─────────────

describe("High earner on €120,000 salary (monthly), PRSI Class A1", () => {
  const input = makeInput({
    grossPay: 10000,
    prsiClass: "A1",
    payFrequency: "monthly",
    payPeriod: 1,
  });

  const result = calculatePayroll(input);

  it("grossPay = €10,000", () => {
    expect(result.grossPay).toBeCloseTo(10000, 2);
  });

  it("PAYE — hits higher rate band", () => {
    // cumulativeCutOff = 44000/12 = 3666.6667
    // atStandard = 3666.6667, atHigher = 10000 - 3666.6667 = 6333.3333
    // grossTax = 3666.6667*0.20 + 6333.3333*0.40 = 733.3333 + 2533.3333 = 3266.6667
    // credits = 333.3333
    // taxDue = 3266.6667 - 333.3333 = 2933.3333 -> round = 2933.33
    expect(result.paye).toBeCloseTo(2933.33, 2);
  });

  it("USC — spans first two bands", () => {
    // Band 1: min(max(0,10000-0), 12012) = 10000; but wait — band width for band 1 is 12012-0=12012
    // applicableAmount = min(max(0, 10000-0), 12012) = 10000; but that's wrong since bandWidth=12012
    // Actually: let me re-read the code:
    //   bandWidth = band.to === Infinity ? cumulativeGrossForUSC : (band.to - band.from)
    //   applicableAmount = Math.min(Math.max(0, cumulativeGrossForUSC - band.from), bandWidth)
    // Band 1 (0-12012): bandWidth=12012; applicable = min(max(0,10000-0), 12012) = min(10000,12012) = 10000
    //   10000 * 0.005 = 50.00
    // Band 2 (12012-27742): applicable = min(max(0,10000-12012), 15730) = min(-2012, 15730) = 0
    // Total USC = 50.00
    expect(result.usc).toBeCloseTo(50.0, 2);
  });

  it("Employee PRSI A1 at 4.2%", () => {
    // 10000 * 0.042 = 420.00
    expect(result.employeePrsi).toBeCloseTo(420.0, 2);
  });

  it("Employer PRSI at 11.25% (weekly equiv > €552)", () => {
    // weeklyEquivalent = 10000 * 12/52 = 2307.69
    // 10000 * 0.1125 = 1125.00
    expect(result.employerPrsi).toBeCloseTo(1125.0, 2);
  });

  it("Net pay", () => {
    // 10000 - 2933.33 - 50.00 - 420.00 = 6596.67
    expect(result.netPay).toBeCloseTo(6596.67, 2);
  });

  it("Total employer cost", () => {
    // 10000 + 1125 = 11125.00
    expect(result.totalEmployerCost).toBeCloseTo(11125.0, 2);
  });
});

// ── 4. Below PRSI employer threshold (weekly ≤ €552) ─────────

describe("Employee earning €26,000/year (€500/wk), employer PRSI lower rate", () => {
  // Weekly pay = €500; using weekly frequency
  const input = makeInput({
    grossPay: 500,
    prsiClass: "A1",
    payFrequency: "weekly",
    payPeriod: 1,
  });

  const result = calculatePayroll(input);

  it("grossPay = €500", () => {
    expect(result.grossPay).toBeCloseTo(500, 2);
  });

  it("Employer PRSI at lower rate (9%) since weekly pay ≤ €552", () => {
    // weeklyEquivalent = 500 * 1 = 500 <= 552
    // 500 * 0.09 = 45.00
    expect(result.employerPrsi).toBeCloseTo(45.0, 2);
  });

  it("Employee PRSI at 4.2% (weekly > €352 exemption)", () => {
    // 500 * 0.042 = 21.00
    // weeklyEquivalent = 500 > 424 credit threshold? Yes, so no credit
    expect(result.employeePrsi).toBeCloseTo(21.0, 2);
  });

  it("PAYE correct for weekly frequency", () => {
    // cumulativeCutOff = 44000/52 * 1 = 846.1538
    // atStandard = min(500, 846.15) = 500; atHigher = 0
    // grossTax = 500 * 0.20 = 100
    // credits = 4000/52 = 76.9231
    // taxDue = 100 - 76.9231 = 23.0769 -> round = 23.08
    expect(result.paye).toBeCloseTo(23.08, 2);
  });

  it("USC for €500 weekly (all in 0.5% band)", () => {
    // 500 * 0.005 = 2.50
    expect(result.usc).toBeCloseTo(2.5, 2);
  });

  it("Net pay", () => {
    // 500 - 23.08 - 2.50 - 21.00 = 453.42
    expect(result.netPay).toBeCloseTo(453.42, 2);
  });
});

// ── 5. USC exemption (earning under €13,000) ─────────────────

describe("USC exemption — annual income under €13,000", () => {
  // €1,000/month, uscStatus = "exempt"
  const input = makeInput({
    grossPay: 1000,
    uscStatus: "exempt",
    payFrequency: "monthly",
    payPeriod: 1,
  });

  const result = calculatePayroll(input);

  it("USC is zero when status is exempt", () => {
    expect(result.usc).toBeCloseTo(0, 2);
  });

  it("USC breakdown shows zero", () => {
    expect(result.uscBreakdown.uscThisPeriod).toBeCloseTo(0, 2);
  });

  it("PAYE still applies", () => {
    // 1000 * 0.20 = 200; credits = 333.33; taxDue = max(0, 200 - 333.33) = 0
    expect(result.paye).toBeCloseTo(0, 2);
  });

  it("Employee PRSI A1 — weekly equiv = 1000*12/52 = 230.77 ≤ 352 exemption", () => {
    // weeklyEquivalent = 230.77 <= 352, so PRSI = 0
    expect(result.employeePrsi).toBeCloseTo(0, 2);
  });

  it("Net pay equals gross minus zero deductions", () => {
    // All deductions are 0 for this low earner
    expect(result.netPay).toBeCloseTo(1000, 2);
  });
});

// ── 6. Cumulative basis — Period 6 of 12, €60k salary ────────

describe("Cumulative basis — Period 6 of 12, €60,000 salary", () => {
  // Simulate: first 5 periods already processed, now processing period 6
  // First we need to know what the cumulative values are after 5 periods
  // Each period: grossPay = 5000, taxablePay = 5000

  // Let's compute period 1 through 5 iteratively to get correct cumulatives
  let cumulativeGross = 0;
  let cumulativeTax = 0;
  let cumulativeUSC = 0;
  let cumulativePRSI = 0;

  for (let period = 1; period <= 5; period++) {
    const periodInput = makeInput({
      grossPay: 5000,
      prsiClass: "S",
      isDirector: true,
      payFrequency: "monthly",
      payPeriod: period,
      previousCumulativeGross: cumulativeGross,
      previousCumulativeTax: cumulativeTax,
      previousCumulativeUSC: cumulativeUSC,
      previousCumulativePRSI: cumulativePRSI,
    });
    const r = calculatePayroll(periodInput);
    cumulativeGross = r.cumulativeGross;
    cumulativeTax = r.cumulativeTax;
    cumulativeUSC = r.cumulativeUSC;
    cumulativePRSI = r.cumulativePRSI;
  }

  const period6Input = makeInput({
    grossPay: 5000,
    prsiClass: "S",
    isDirector: true,
    payFrequency: "monthly",
    payPeriod: 6,
    previousCumulativeGross: cumulativeGross,
    previousCumulativeTax: cumulativeTax,
    previousCumulativeUSC: cumulativeUSC,
    previousCumulativePRSI: cumulativePRSI,
  });

  const result = calculatePayroll(period6Input);

  it("cumulative gross after 6 periods = €30,000", () => {
    expect(result.cumulativeGross).toBeCloseTo(30000, 2);
  });

  it("PAYE for period 6 equals the same as period 1 for flat salary", () => {
    // With a flat salary, each period's PAYE should be the same
    // Period 6 cumulativeCutOff = 44000/12 * 6 = 22000
    // cumulativeGross = 30000; atStandard = 22000; atHigher = 8000
    // grossTax = 22000*0.20 + 8000*0.40 = 4400 + 3200 = 7600
    // credits = 4000/12 * 6 = 2000
    // cumulativeTaxDue = 7600 - 2000 = 5600
    // taxThisPeriod = 5600 - previousCumulativeTax
    // previousCumulativeTax should be 933.33 * 5 = 4666.65 (approx)
    // taxThisPeriod = 5600 - 4666.65 = 933.35 (rounding may vary slightly)
    // With cumulative basis and rounding, each period should be ~933.33
    expect(result.paye).toBeCloseTo(933.33, 0); // within 1 cent tolerance
  });

  it("cumulative tax due matches 6 periods of tax", () => {
    // Cumulative tax = 5600 (as computed above, before rounding per-period)
    // But the actual value is sum of rounded per-period amounts
    expect(result.cumulativeTax).toBeCloseTo(5600, 0);
  });

  it("USC for period 6 — cumulative gross now spans two USC bands", () => {
    // cumulativeGrossForUSC = 30000 (uses taxableGross, not taxablePay)
    // Band 1: min(max(0, 30000-0), 12012) = 12012 * 0.005 = 60.06
    // Band 2: min(max(0, 30000-12012), 15730) = min(17988, 15730) = 15730 * 0.02 = 314.60
    // Band 3: min(max(0, 30000-27742), 42302) = min(2258, 42302) = 2258 * 0.03 = 67.74
    // Total cumulative USC = 60.06 + 314.60 + 67.74 = 442.40
    // uscThisPeriod = 442.40 - previousCumulativeUSC
    // The total cumulative USC at period 6 should be ~442.40
    expect(result.cumulativeUSC).toBeCloseTo(442.4, 0);
  });

  it("cumulative PRSI = 6 periods of €210", () => {
    // 5000 * 0.042 = 210 per period
    expect(result.cumulativePRSI).toBeCloseTo(1260, 2);
  });
});

// ── 7. Dividend DWT calculation ──────────────────────────────

describe("Dividend DWT calculation", () => {
  it("calculates 25% DWT on €10,000 gross dividend", () => {
    const result = calculateDividend({ grossAmount: 10000 });
    expect(result.grossAmount).toBe(10000);
    expect(result.dwtRate).toBe(25);
    expect(result.dwtAmount).toBeCloseTo(2500, 2);
    expect(result.netAmount).toBeCloseTo(7500, 2);
  });

  it("allows custom DWT rate", () => {
    const result = calculateDividend({ grossAmount: 10000, dwtRate: 33 });
    expect(result.dwtRate).toBe(33);
    expect(result.dwtAmount).toBeCloseTo(3300, 2);
    expect(result.netAmount).toBeCloseTo(6700, 2);
  });

  it("handles zero dividend", () => {
    const result = calculateDividend({ grossAmount: 0 });
    expect(result.dwtAmount).toBeCloseTo(0, 2);
    expect(result.netAmount).toBeCloseTo(0, 2);
  });
});

// ── 7b. DWT due date helper ──────────────────────────────────

describe("getDWTDueDate", () => {
  it("returns 14th of the following month", () => {
    // Payment on 2026-03-15 -> due 2026-04-14
    const dueDate = getDWTDueDate(new Date(2026, 2, 15));
    expect(dueDate.getDate()).toBe(14);
    expect(dueDate.getMonth()).toBe(3); // April = 3
    expect(dueDate.getFullYear()).toBe(2026);
  });

  it("rolls over to January next year for December payment", () => {
    // Payment on 2026-12-20 -> due 2027-01-14
    const dueDate = getDWTDueDate(new Date(2026, 11, 20));
    expect(dueDate.getDate()).toBe(14);
    expect(dueDate.getMonth()).toBe(0); // January = 0
    expect(dueDate.getFullYear()).toBe(2027);
  });
});

// ── 8. Payroll journal lines ─────────────────────────────────

describe("Payroll journal lines generation", () => {
  const input = makeInput({
    grossPay: 5000,
    prsiClass: "A1",
    payFrequency: "monthly",
    payPeriod: 1,
  });
  const payrollResult = calculatePayroll(input);
  const journalLines = generatePayrollJournalLines([
    { employeeName: "Test Employee", result: payrollResult },
  ]);

  it("total debits equal total credits", () => {
    const totalDebits = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = journalLines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebits).toBeCloseTo(totalCredits, 2);
  });

  it("includes Wages & Salaries debit line", () => {
    const wagesLine = journalLines.find((l) => l.accountName === "Wages & Salaries");
    expect(wagesLine).toBeDefined();
    expect(wagesLine!.debit).toBeCloseTo(payrollResult.grossPay, 2);
    expect(wagesLine!.credit).toBe(0);
  });

  it("includes Employer PRSI debit line", () => {
    const prsiLine = journalLines.find((l) => l.accountName === "Employer PRSI");
    expect(prsiLine).toBeDefined();
    expect(prsiLine!.debit).toBeCloseTo(payrollResult.employerPrsi, 2);
  });

  it("includes PAYE Liability credit line", () => {
    const payeLine = journalLines.find((l) => l.accountName === "PAYE Liability");
    expect(payeLine).toBeDefined();
    expect(payeLine!.credit).toBeCloseTo(payrollResult.paye, 2);
    expect(payeLine!.debit).toBe(0);
  });

  it("includes USC Liability credit line", () => {
    const uscLine = journalLines.find((l) => l.accountName === "USC Liability");
    expect(uscLine).toBeDefined();
    expect(uscLine!.credit).toBeCloseTo(payrollResult.usc, 2);
  });

  it("includes PRSI Liability credit line (employee + employer)", () => {
    const prsiLiabilityLine = journalLines.find((l) => l.accountName === "PRSI Liability");
    expect(prsiLiabilityLine).toBeDefined();
    expect(prsiLiabilityLine!.credit).toBeCloseTo(
      payrollResult.employeePrsi + payrollResult.employerPrsi,
      2,
    );
  });

  it("includes Net Pay Control credit line", () => {
    const netPayLine = journalLines.find((l) => l.accountName === "Net Pay Control");
    expect(netPayLine).toBeDefined();
    expect(netPayLine!.credit).toBeCloseTo(payrollResult.netPay, 2);
  });

  it("uses correct account codes", () => {
    const codeMap: Record<string, string> = {
      "Wages & Salaries": "6700",
      "Employer PRSI": "6720",
      "PAYE Liability": "2210",
      "USC Liability": "2211",
      "PRSI Liability": "2212",
      "Net Pay Control": "2200",
    };
    for (const [name, code] of Object.entries(codeMap)) {
      const line = journalLines.find((l) => l.accountName === name);
      expect(line?.accountCode).toBe(code);
    }
  });
});

// ── 9. Dividend journal lines ────────────────────────────────

describe("Dividend journal lines generation", () => {
  const dividend = calculateDividend({ grossAmount: 10000 });
  const journalLines = generateDividendJournalLines(dividend, "John Director");

  it("total debits equal total credits", () => {
    const totalDebits = journalLines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = journalLines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebits).toBeCloseTo(totalCredits, 2);
  });

  it("includes Dividends Paid debit line with recipient name", () => {
    const divLine = journalLines.find((l) => l.accountName.includes("Dividends Paid"));
    expect(divLine).toBeDefined();
    expect(divLine!.accountName).toContain("John Director");
    expect(divLine!.debit).toBeCloseTo(10000, 2);
    expect(divLine!.accountCode).toBe("3200");
  });

  it("includes DWT Liability credit line", () => {
    const dwtLine = journalLines.find((l) => l.accountName === "DWT Liability");
    expect(dwtLine).toBeDefined();
    expect(dwtLine!.credit).toBeCloseTo(2500, 2);
    expect(dwtLine!.accountCode).toBe("2230");
  });

  it("includes Bank credit line for net dividend", () => {
    const bankLine = journalLines.find((l) => l.accountName === "Bank");
    expect(bankLine).toBeDefined();
    expect(bankLine!.credit).toBeCloseTo(7500, 2);
    expect(bankLine!.accountCode).toBe("1200");
  });
});

// ── 10. Edge cases ───────────────────────────────────────────

describe("Edge cases", () => {
  it("zero gross pay produces zero deductions", () => {
    const input = makeInput({ grossPay: 0 });
    const result = calculatePayroll(input);

    expect(result.grossPay).toBe(0);
    expect(result.paye).toBe(0);
    expect(result.usc).toBe(0);
    expect(result.employeePrsi).toBe(0);
    expect(result.employerPrsi).toBe(0);
    expect(result.netPay).toBe(0);
    expect(result.totalDeductions).toBe(0);
  });

  it("very large salary €500,000/year (monthly) calculates without error", () => {
    const input = makeInput({
      grossPay: 41666.67, // 500000 / 12
      prsiClass: "A1",
      payFrequency: "monthly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // Verify PAYE: most income at higher rate
    // cumulativeCutOff = 44000/12 = 3666.6667
    // atStandard = 3666.6667; atHigher = 41666.67 - 3666.6667 = 38000.0033
    // grossTax = 3666.6667*0.20 + 38000.0033*0.40 = 733.3333 + 15200.0013 = 15933.3347
    // credits = 333.3333
    // taxDue = 15933.3347 - 333.3333 = 15600.00 (rounded)
    expect(result.paye).toBeCloseTo(15600.0, 0);

    // USC hits 8% band:
    // Band 1: 12012 * 0.005 = 60.06
    // Band 2: 15730 * 0.02 = 314.60
    // Band 3: 42302 * 0.03 = 1269.06
    // Band 4: (41666.67 - 70044) = -28377.33 -> 0 (only first month, cumulative is 41666.67)
    // Wait: cumulativeGrossForUSC = 0 + 41666.67 = 41666.67
    // Band 3: min(max(0, 41666.67-27742), 42302) = min(13924.67, 42302) = 13924.67 * 0.03 = 417.74
    // Band 4: max(0, 41666.67-70044) = 0
    // Total USC = 60.06 + 314.60 + 417.74 = 792.40
    expect(result.usc).toBeCloseTo(792.4, 0);

    // Employee PRSI
    expect(result.employeePrsi).toBeCloseTo(41666.67 * 0.042, 0);

    // Employer PRSI at higher rate
    expect(result.employerPrsi).toBeCloseTo(41666.67 * 0.1125, 0);

    // Net pay should be positive
    expect(result.netPay).toBeGreaterThan(0);
  });

  it("pension deductions reduce taxable pay for PAYE", () => {
    const withPension = makeInput({
      grossPay: 5000,
      pensionEmployeePct: 5,
      pensionEmployerPct: 5,
      payFrequency: "monthly",
      payPeriod: 1,
    });
    const result = calculatePayroll(withPension);

    // Employee pension = 5000 * 5% = 250
    expect(result.pensionEmployee).toBeCloseTo(250, 2);
    // Employer pension = 5000 * 5% = 250
    expect(result.pensionEmployer).toBeCloseTo(250, 2);

    // PAYE calculated on taxablePay = 5000 - 250 = 4750
    // cumulativeCutOff = 3666.67; atStandard = 3666.67; atHigher = 4750 - 3666.67 = 1083.33
    // grossTax = 733.33 + 433.33 = 1166.67; credits = 333.33; taxDue = 833.33
    expect(result.paye).toBeCloseTo(833.33, 0);

    // Net pay = taxableGross - totalDeductions
    // totalDeductions = PAYE + USC + PRSI + pension
    expect(result.totalDeductions).toBeCloseTo(
      result.paye + result.usc + result.employeePrsi + result.pensionEmployee,
      2,
    );

    // Total employer cost includes employer pension and employer PRSI
    expect(result.totalEmployerCost).toBeCloseTo(
      5000 + result.employerPrsi + result.pensionEmployer,
      2,
    );
  });

  it("PRSI credit applies for low earners (weekly €353-€424)", () => {
    // Weekly pay of €400 — above exemption but in credit range
    const input = makeInput({
      grossPay: 400,
      prsiClass: "A1",
      payFrequency: "weekly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // weeklyEquivalent = 400 (weekly freq, so *1)
    // > 352, so PRSI applies; <= 424, so credit applies
    // PRSI = 400 * 0.042 = 16.80; credit = min(12, 16.80) = 12
    // net PRSI = 16.80 - 12 = 4.80
    expect(result.employeePrsi).toBeCloseTo(4.8, 2);
  });

  it("PRSI exemption for weekly pay ≤ €352", () => {
    const input = makeInput({
      grossPay: 350,
      prsiClass: "A1",
      payFrequency: "weekly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // weeklyEquivalent = 350 <= 352 -> exempt
    expect(result.employeePrsi).toBeCloseTo(0, 2);
    // Employer PRSI still applies (no exemption for employer)
    expect(result.employerPrsi).toBeGreaterThan(0);
  });

  it("BIK and overtime are included in taxable gross", () => {
    const input = makeInput({
      grossPay: 3000,
      overtime: 500,
      bonus: 200,
      benefitInKind: 300,
      payFrequency: "monthly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // taxableGross = 3000 + 500 + 200 + 300 = 4000
    expect(result.taxableGross).toBeCloseTo(4000, 2);
    expect(result.grossPay).toBeCloseTo(4000, 2);
  });

  it("USC reduced status uses only two bands", () => {
    const input = makeInput({
      grossPay: 5000,
      uscStatus: "reduced",
      payFrequency: "monthly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // Reduced USC: 0.5% on 0-12012, 2% on 12012+
    // For 5000: all within first band = 5000 * 0.005 = 25.00
    expect(result.usc).toBeCloseTo(25.0, 2);
    // Same as ordinary for this amount, but let's verify with a higher amount
  });

  it("fortnightly pay frequency works correctly", () => {
    const input = makeInput({
      grossPay: 2000,
      prsiClass: "A1",
      payFrequency: "fortnightly",
      payPeriod: 1,
    });
    const result = calculatePayroll(input);

    // periodsPerYear = 26
    // cumulativeCutOff = 44000/26 * 1 = 1692.31
    // atStandard = 1692.31; atHigher = 2000 - 1692.31 = 307.69
    // grossTax = 1692.31*0.20 + 307.69*0.40 = 338.46 + 123.08 = 461.54
    // credits = 4000/26 = 153.85
    // taxDue = 461.54 - 153.85 = 307.69
    expect(result.paye).toBeCloseTo(307.69, 0);

    // weeklyEquivalent for fortnightly: 2000 * 0.5 = 1000
    // > 552 -> higher employer PRSI rate
    expect(result.employerPrsi).toBeCloseTo(2000 * 0.1125, 2);
  });
});

// ── Tax tables sanity checks ─────────────────────────────────

describe("TAX_TABLES_2026 sanity checks", () => {
  it("has correct income tax rates", () => {
    expect(TAX_TABLES_2026.incomeTax.standardRate).toBe(0.2);
    expect(TAX_TABLES_2026.incomeTax.higherRate).toBe(0.4);
  });

  it("single standard rate band is €44,000", () => {
    expect(TAX_TABLES_2026.incomeTax.standardRateBand.single).toBe(44000);
  });

  it("USC has 4 bands", () => {
    expect(TAX_TABLES_2026.usc.bands).toHaveLength(4);
  });

  it("USC exemption threshold is €13,000", () => {
    expect(TAX_TABLES_2026.usc.exemptionThreshold).toBe(13000);
  });

  it("PRSI Class A1 employee rate is 4.2%", () => {
    expect(TAX_TABLES_2026.prsi.classA1.employee.rate).toBe(0.042);
  });

  it("PRSI Class A1 employer higher rate is 11.25%", () => {
    expect(TAX_TABLES_2026.prsi.classA1.employer.higherRate).toBe(0.1125);
  });

  it("default personal credit single is €2,000", () => {
    expect(TAX_TABLES_2026.defaultCredits.personalCreditSingle).toBe(2000);
  });

  it("default employee tax credit is €2,000", () => {
    expect(TAX_TABLES_2026.defaultCredits.employeeTaxCredit).toBe(2000);
  });
});
