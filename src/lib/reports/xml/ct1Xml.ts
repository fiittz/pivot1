import type { CT1ReportData } from "../types";
import { xmlDeclaration, xmlTag, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

export interface CT1XmlOptions {
  periodStart: string;    // ISO date
  periodEnd: string;      // ISO date
  companyRegNo: string;   // CRO number
  taxRefNo: string;       // Revenue tax reference
  isCloseCompany: boolean;
  rctCredit?: number;
  preliminaryCTPaid?: number;
}

/**
 * Build CT1 XML string from report data.
 * Revenue FormCt1 schema — currency EUR, formversion 25.
 */
export function buildCT1Xml(data: CT1ReportData, options: CT1XmlOptions): string {
  const tradingIncome = wholeEuro(data.totalIncome);
  const allowableDeductions = wholeEuro(data.totalDeductions);
  const tradingProfit = wholeEuro(data.tradingProfit);
  const totalCT = wholeEuro(data.totalCTLiability);
  const prelimPaid = wholeEuro(options.preliminaryCTPaid ?? 0);
  const rctCredit = wholeEuro(options.rctCredit ?? 0);
  const balanceDue = totalCT - prelimPaid - rctCredit;

  let closeCompanySection = "";
  if (options.isCloseCompany) {
    // Extract surcharge from CT liability if close company
    const ctAt125 = wholeEuro(tradingProfit * 0.125);
    const surcharge = totalCT - ctAt125;
    if (surcharge > 0) {
      closeCompanySection = `
  <CloseCompanySurcharge>
    ${xmlTag("SurchargeApplicable", "Y")}
    ${xmlTag("SurchargeAmount", wholeEuro(surcharge))}
  </CloseCompanySurcharge>`;
    }
  }

  return `${xmlDeclaration()}
<FormCt1 xmlns="http://www.revenue.ie/schemas/ct1" currency="E" formversion="25">
  ${xmlTag("CompanyRegNo", options.companyRegNo)}
  ${xmlTag("TaxRefNo", options.taxRefNo)}
  ${xmlTag("PeriodStart", fmtRevDate(options.periodStart))}
  ${xmlTag("PeriodEnd", fmtRevDate(options.periodEnd))}
  ${xmlTag("CompanyName", data.meta.companyName)}
  <TradingIncome>
    ${xmlTag("TotalTradingIncome", tradingIncome)}
    ${xmlTag("AllowableDeductions", allowableDeductions)}
    ${xmlTag("TradingProfit", tradingProfit)}
  </TradingIncome>
  <CorporationTax>
    ${xmlTag("TaxableProfit", tradingProfit)}
    ${xmlTag("CTRate", "12.5")}
    ${xmlTag("CTOnTradingIncome", wholeEuro(tradingProfit * 0.125))}
    ${xmlTag("TotalCTLiability", totalCT)}
  </CorporationTax>${closeCompanySection}
  <PaymentsCredits>
    ${xmlTag("PreliminaryCTPaid", prelimPaid)}
    ${xmlTag("RCTCredit", rctCredit)}
    ${xmlTag("BalanceDue", wholeEuro(balanceDue))}
  </PaymentsCredits>
</FormCt1>`;
}

/** Generate CT1 XML and trigger download */
export function generateCT1Xml(data: CT1ReportData, options: CT1XmlOptions): void {
  const xml = buildCT1Xml(data, options);
  const company = data.meta.companyName.replace(/\s+/g, "_");
  saveXml(xml, `CT1_${company}_${data.meta.taxYear}.xml`);
}
