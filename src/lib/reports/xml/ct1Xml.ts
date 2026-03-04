import type { CT1ReportData } from "../types";
import { xmlDeclaration, xmlEl, wholeEuro, saveXml } from "../xmlHelpers";

export interface CT1XmlOptions {
  periodStart: string;    // ISO date
  periodEnd: string;      // ISO date
  companyRegNo: string;   // CRO number
  taxRefNo: string;       // Revenue tax reference
  companyName: string;
  isCloseCompany: boolean;
  rctCredit?: number;
  preliminaryCTPaid?: number;
  language?: string;      // default "EN"
}

/**
 * Build CT1 XML string from report data.
 * Revenue FormCt1 v25 XSD — attribute-based elements, currency EUR.
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

  // Close company surcharge
  let closeCompanySection = "";
  if (options.isCloseCompany) {
    const surcharge = totalCT - ctAt125;
    if (surcharge > 0) {
      closeCompanySection = `
  <CloseCompanySurcharge>
    ${xmlEl("CloseCompanySurcharge", { electUnderSec440441: "true", section440: wholeEuro(surcharge) })}
  </CloseCompanySurcharge>`;
    }
  }

  return `${xmlDeclaration()}
<FormCt1 xmlns="http://www.ros.ie/schemas/formct1/v25/" currency="E" formversion="25" language="${lang}">
  <CompanyDetails>
    ${xmlEl("CompanyDetails", { referencenumber: options.taxRefNo, companyname: options.companyName })}
    <ReturnContactDetails/>
  </CompanyDetails>
  <TradingResults>
    ${xmlEl("TradeProfits", { profityear: tradingProfit })}
  </TradingResults>${closeCompanySection}
  <Deductions>
    ${xmlEl("Credits", { pswtOnFees: 0 })}
  </Deductions>
  <SelfAssessmentCt>
    ${xmlEl("SelfAssessmentCt", {
      selfProfitChargeTax: tradingProfit,
      selfTaxCharge: totalCT,
      selfTaxPayable: totalCT,
      selfAmtTaxPaidDirect: prelimPaid,
      selfBalanceTaxPayable: wholeEuro(balanceDue),
      declareSelfAssessment: "true",
    })}
  </SelfAssessmentCt>
  <SummaryCalculation>
    ${xmlEl("SummaryCalculation", {
      tradingIncome: totalIncome,
      totalIncome: totalIncome,
      totalDeductions: totalDeductions,
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
  </SummaryCalculation>
</FormCt1>`;
}

/** Generate CT1 XML and trigger download */
export function generateCT1Xml(data: CT1ReportData, options: CT1XmlOptions): void {
  const xml = buildCT1Xml(data, options);
  const company = options.companyName.replace(/\s+/g, "_");
  saveXml(xml, `CT1_${company}_${data.meta.taxYear}.xml`);
}
