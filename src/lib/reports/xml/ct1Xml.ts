import type { CT1ReportData } from "../types";
import { xmlDeclaration, xmlEl, xmlTag, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

export interface CT1XmlOptions {
  periodStart: string;    // ISO date
  periodEnd: string;      // ISO date
  companyRegNo: string;   // CRO number
  taxRefNo: string;       // Revenue tax reference
  companyName: string;
  isCloseCompany: boolean;
  rctCredit?: number;
  preliminaryCTPaid?: number;
  preliminaryCTDate?: string; // ISO date
  language?: string;      // default "EN"

  // ── From questionnaire / onboarding ──

  // Balance sheet — Fixed assets
  fixedAssetsLandBuildings?: number;
  fixedAssetsPlantMachinery?: number;
  fixedAssetsMotorVehicles?: number;
  fixedAssetsFixturesFittings?: number;

  // Balance sheet — Current assets
  currentAssetsStock?: number;
  currentAssetsDebtors?: number;
  currentAssetsCash?: number;
  currentAssetsBankBalance?: number;

  // Balance sheet — Liabilities
  liabilitiesCreditors?: number;
  liabilitiesTaxation?: number;
  liabilitiesBankLoans?: number;
  liabilitiesDirectorsLoans?: number;
  directorsLoanDirection?: "owed_to" | "owed_by";

  // Capital allowances
  capitalAllowancesPlant?: number;
  capitalAllowancesMotorVehicles?: number;

  // Add-backs from P&L
  addBackDepreciation?: number;
  addBackEntertainment?: number;
  addBackOther?: number;
  addBackNotes?: string;

  // Losses
  lossesForward?: number;
  closeCompanySurcharge?: number;

  // Distributions
  hasDividendsPaid?: boolean;
  dividendsPaidAmount?: number;
  dwtDeducted?: number;

  // Capital gains / disposals
  hasAssetDisposals?: boolean;
  disposals?: Array<{
    description: string;
    dateAcquired: string;
    dateSold: string;
    costPrice: number;
    salePrice: number;
  }>;

  // Startup exemption s.486C
  claimStartupExemption?: boolean;
  startupExemptionAmount?: number;

  // RCT detail
  rctApplicable?: boolean;
  rctTotalDeducted?: number;

  // VAT
  vatStatus?: string;

  // Directors
  directorNames?: string[];
  directorSalaries?: number[];

  // Stock
  closingStockValue?: number;
  stockValuationMethod?: string;

  // Accrual adjustments
  prepaymentsAmount?: number;
  accrualsAmount?: number;
  accruedIncomeAmount?: number;
  deferredIncomeAmount?: number;
}

/**
 * Build CT1 XML string from report data.
 * Revenue FormCt1 v25 XSD — attribute-based elements, currency EUR.
 *
 * Maps questionnaire and finalization data to Revenue-required fields.
 */
export function buildCT1Xml(data: CT1ReportData, options: CT1XmlOptions): string {
  const lang = options.language ?? "EN";
  const tradingProfit = wholeEuro(data.tradingProfit);
  const totalIncome = wholeEuro(data.totalIncome);
  const totalDeductions = wholeEuro(data.totalDeductions);
  const totalCT = wholeEuro(data.totalCTLiability);
  const prelimPaid = wholeEuro(options.preliminaryCTPaid ?? 0);
  const rctCredit = wholeEuro(options.rctCredit ?? 0);
  const balanceDue = totalCT - prelimPaid - rctCredit;

  // Tax at 12.5% on trading profits
  const ctAt125 = wholeEuro(tradingProfit * 0.125);

  // ── Company Details ──
  const companyDetails = `
  <CompanyDetails>
    ${xmlEl("CompanyDetails", {
      referencenumber: options.taxRefNo,
      companyname: options.companyName,
      companyregnumber: options.companyRegNo || null,
    })}
    <ReturnContactDetails/>
  </CompanyDetails>`;

  // ── Directors ──
  let directorsSection = "";
  if (options.directorNames && options.directorNames.length > 0) {
    const directorLines = options.directorNames.map((name, i) => {
      const salary = options.directorSalaries?.[i] ?? 0;
      return `    ${xmlEl("Director", {
        directornumber: i + 1,
        directorname: name,
        directorremuneration: wholeEuro(salary),
      })}`;
    }).join("\n");
    directorsSection = `
  <Directors>
${directorLines}
  </Directors>`;
  }

  // ── Trading Results ──
  const tradingResults = `
  <TradingResults>
    ${xmlEl("TradeProfits", { profityear: tradingProfit })}
  </TradingResults>`;

  // ── Add-backs (Schedule of Non-Deductible Expenses) ──
  let addBacksSection = "";
  const depn = wholeEuro(options.addBackDepreciation ?? 0);
  const ent = wholeEuro(options.addBackEntertainment ?? 0);
  const other = wholeEuro(options.addBackOther ?? 0);
  const totalAddBacks = depn + ent + other;
  if (totalAddBacks > 0) {
    addBacksSection = `
  <AddBacks>
    ${xmlEl("AddBacks", {
      depreciation: depn || null,
      entertainment: ent || null,
      otherDisallowed: other || null,
      totalAddBacks: totalAddBacks,
      addBackNotes: options.addBackNotes || null,
    })}
  </AddBacks>`;
  }

  // ── Capital Allowances ──
  let capitalAllowancesSection = "";
  const capPlant = wholeEuro(options.capitalAllowancesPlant ?? 0);
  const capMotor = wholeEuro(options.capitalAllowancesMotorVehicles ?? 0);
  const totalCapAllowances = capPlant + capMotor;
  if (totalCapAllowances > 0) {
    capitalAllowancesSection = `
  <CapitalAllowances>
    ${xmlEl("CapitalAllowances", {
      plantAndMachinery: capPlant || null,
      motorVehicles: capMotor || null,
      totalCapitalAllowances: totalCapAllowances,
    })}
  </CapitalAllowances>`;
  }

  // ── Losses Brought Forward (s.396 TCA 1997) ──
  let lossesSection = "";
  const losses = wholeEuro(options.lossesForward ?? 0);
  if (losses > 0) {
    lossesSection = `
  <LossesBroughtForward>
    ${xmlEl("LossesBroughtForward", {
      lossesClaimedCurrentYear: losses,
      section: "396",
    })}
  </LossesBroughtForward>`;
  }

  // ── Close Company Surcharge ──
  let closeCompanySection = "";
  if (options.isCloseCompany) {
    const surcharge = wholeEuro(options.closeCompanySurcharge ?? (totalCT - ctAt125 > 0 ? totalCT - ctAt125 : 0));
    closeCompanySection = `
  <CloseCompanySurcharge>
    ${xmlEl("CloseCompanySurcharge", {
      electUnderSec440441: "true",
      section440: surcharge || null,
    })}
  </CloseCompanySurcharge>`;

    // Directors' loans (s.438 close company surcharge)
    if (options.liabilitiesDirectorsLoans && options.directorsLoanDirection === "owed_by") {
      closeCompanySection += `
  <CloseCompanyLoans>
    ${xmlEl("DirectorsLoan", {
      amountOwedByDirectors: wholeEuro(options.liabilitiesDirectorsLoans),
      section438Applicable: "true",
    })}
  </CloseCompanyLoans>`;
    }
  }

  // ── Distributions (DWT) ──
  let distributionsSection = "";
  if (options.hasDividendsPaid && (options.dividendsPaidAmount ?? 0) > 0) {
    distributionsSection = `
  <Distributions>
    ${xmlEl("Distributions", {
      dividendsPaid: wholeEuro(options.dividendsPaidAmount ?? 0),
      dwtDeducted: wholeEuro(options.dwtDeducted ?? 0),
    })}
  </Distributions>`;
  }

  // ── Capital Gains / Asset Disposals ──
  let cgtSection = "";
  if (options.hasAssetDisposals && options.disposals && options.disposals.length > 0) {
    const disposalLines = options.disposals.map((d) => {
      const gain = d.salePrice - d.costPrice;
      return `    ${xmlEl("Disposal", {
        description: d.description,
        dateAcquired: fmtRevDate(d.dateAcquired),
        dateSold: fmtRevDate(d.dateSold),
        costPrice: wholeEuro(d.costPrice),
        salePrice: wholeEuro(d.salePrice),
        gainOrLoss: wholeEuro(gain),
      })}`;
    }).join("\n");
    const totalGains = options.disposals.reduce((s, d) => s + Math.max(0, d.salePrice - d.costPrice), 0);
    const totalLosses = options.disposals.reduce((s, d) => s + Math.max(0, d.costPrice - d.salePrice), 0);
    cgtSection = `
  <CapitalGains>
${disposalLines}
    ${xmlEl("CGTSummary", {
      totalGains: wholeEuro(totalGains),
      totalLosses: wholeEuro(totalLosses),
      netChargeableGains: wholeEuro(Math.max(0, totalGains - totalLosses)),
      cgtRate: "33",
      cgtPayable: wholeEuro(Math.max(0, totalGains - totalLosses) * 0.33),
    })}
  </CapitalGains>`;
  }

  // ── Startup Exemption s.486C ──
  let startupSection = "";
  if (options.claimStartupExemption && (options.startupExemptionAmount ?? 0) > 0) {
    startupSection = `
  <StartupExemption>
    ${xmlEl("Section486C", {
      exemptionClaimed: wholeEuro(options.startupExemptionAmount ?? 0),
    })}
  </StartupExemption>`;
  }

  // ── Balance Sheet ──
  const fixedAssetsTotal = wholeEuro(
    (options.fixedAssetsLandBuildings ?? 0) +
    (options.fixedAssetsPlantMachinery ?? 0) +
    (options.fixedAssetsMotorVehicles ?? 0) +
    (options.fixedAssetsFixturesFittings ?? 0)
  );
  const currentAssetsTotal = wholeEuro(
    (options.currentAssetsStock ?? 0) +
    (options.currentAssetsDebtors ?? 0) +
    (options.currentAssetsCash ?? 0) +
    (options.currentAssetsBankBalance ?? 0)
  );
  const liabilitiesTotal = wholeEuro(
    (options.liabilitiesCreditors ?? 0) +
    (options.liabilitiesTaxation ?? 0) +
    (options.liabilitiesBankLoans ?? 0) +
    (options.liabilitiesDirectorsLoans ?? 0)
  );
  const hasBalanceSheet = fixedAssetsTotal > 0 || currentAssetsTotal > 0 || liabilitiesTotal > 0;

  let balanceSheetSection = "";
  if (hasBalanceSheet) {
    balanceSheetSection = `
  <BalanceSheet>
    <FixedAssets>
      ${xmlEl("FixedAssets", {
        landAndBuildings: wholeEuro(options.fixedAssetsLandBuildings ?? 0) || null,
        plantAndMachinery: wholeEuro(options.fixedAssetsPlantMachinery ?? 0) || null,
        motorVehicles: wholeEuro(options.fixedAssetsMotorVehicles ?? 0) || null,
        fixturesAndFittings: wholeEuro(options.fixedAssetsFixturesFittings ?? 0) || null,
        totalFixedAssets: fixedAssetsTotal,
      })}
    </FixedAssets>
    <CurrentAssets>
      ${xmlEl("CurrentAssets", {
        stock: wholeEuro(options.currentAssetsStock ?? options.closingStockValue ?? 0) || null,
        debtors: wholeEuro(options.currentAssetsDebtors ?? 0) || null,
        cash: wholeEuro(options.currentAssetsCash ?? 0) || null,
        bankBalance: wholeEuro(options.currentAssetsBankBalance ?? 0) || null,
        prepayments: wholeEuro(options.prepaymentsAmount ?? 0) || null,
        accruedIncome: wholeEuro(options.accruedIncomeAmount ?? 0) || null,
        totalCurrentAssets: currentAssetsTotal,
      })}
    </CurrentAssets>
    <Liabilities>
      ${xmlEl("Liabilities", {
        creditors: wholeEuro(options.liabilitiesCreditors ?? 0) || null,
        taxation: wholeEuro(options.liabilitiesTaxation ?? 0) || null,
        bankLoans: wholeEuro(options.liabilitiesBankLoans ?? 0) || null,
        directorsLoans: wholeEuro(options.liabilitiesDirectorsLoans ?? 0) || null,
        accruals: wholeEuro(options.accrualsAmount ?? 0) || null,
        deferredIncome: wholeEuro(options.deferredIncomeAmount ?? 0) || null,
        totalLiabilities: liabilitiesTotal,
      })}
    </Liabilities>
  </BalanceSheet>`;
  }

  // ── Deductions / Credits ──
  const deductionsSection = `
  <Deductions>
    ${xmlEl("Credits", {
      pswtOnFees: 0,
      rctCredit: rctCredit || null,
      dwtCredit: wholeEuro(options.dwtDeducted ?? 0) || null,
    })}
  </Deductions>`;

  // ── Self Assessment ──
  const selfAssessment = `
  <SelfAssessmentCt>
    ${xmlEl("SelfAssessmentCt", {
      selfProfitChargeTax: tradingProfit,
      selfTaxCharge: totalCT,
      selfTaxPayable: totalCT,
      selfAmtTaxPaidDirect: prelimPaid,
      selfRCTCredit: rctCredit || null,
      selfBalanceTaxPayable: wholeEuro(balanceDue),
      declareSelfAssessment: "true",
    })}
  </SelfAssessmentCt>`;

  // ── Summary Calculation ──
  const summary = `
  <SummaryCalculation>
    ${xmlEl("SummaryCalculation", {
      tradingIncome: totalIncome,
      totalIncome: totalIncome,
      totalDeductions: totalDeductions,
      capitalAllowances: totalCapAllowances || null,
      lossesForward: losses || null,
      totalTax: totalCT,
      totalAmountPayable: wholeEuro(balanceDue),
    })}
    ${xmlEl("TaxableIncomeAtRate", {
      amountChargeableAtRate: tradingProfit,
      percentageRate: "12.5",
      amountPayableAtRate: ctAt125,
      taxIdentifier: "Trading",
      taxOrder: 1,
    })}
  </SummaryCalculation>`;

  return `${xmlDeclaration()}
<FormCt1 xmlns="http://www.ros.ie/schemas/formct1/v25/" currency="E" formversion="25" language="${lang}">${companyDetails}${directorsSection}${tradingResults}${addBacksSection}${capitalAllowancesSection}${lossesSection}${closeCompanySection}${distributionsSection}${cgtSection}${startupSection}${balanceSheetSection}${deductionsSection}${selfAssessment}${summary}
</FormCt1>`;
}

/** Generate CT1 XML and trigger download */
export function generateCT1Xml(data: CT1ReportData, options: CT1XmlOptions): void {
  const xml = buildCT1Xml(data, options);
  const company = options.companyName.replace(/\s+/g, "_");
  saveXml(xml, `CT1_${company}_${data.meta.taxYear}.xml`);
}
