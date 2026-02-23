import type { VATReportData } from "../types";
import { xmlDeclaration, xmlTag, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

export interface VATXmlOptions {
  vatNumber: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
}

/**
 * Build VAT3 XML string from report data.
 * Revenue VAT3 schema v1.5 — maps T1-T4 fields.
 * EU fields (E1/E2/ES1/ES2) default to 0 as no EU trade feature yet.
 */
export function buildVATXml(data: VATReportData, options: VATXmlOptions): string {
  const t1 = wholeEuro(data.t1Sales);
  const t2 = wholeEuro(data.t2Vat);
  const t3 = wholeEuro(data.t3Purchases);
  const t4 = wholeEuro(data.t4InputVat);
  const netVat = wholeEuro(data.netVat);

  return `${xmlDeclaration()}
<VAT3 xmlns="http://www.revenue.ie/schemas/vat3" version="1.5">
  ${xmlTag("VATNumber", options.vatNumber)}
  ${xmlTag("PeriodStart", fmtRevDate(options.periodStart))}
  ${xmlTag("PeriodEnd", fmtRevDate(options.periodEnd))}
  ${xmlTag("T1", t1)}
  ${xmlTag("T2", t2)}
  ${xmlTag("T3", t3)}
  ${xmlTag("T4", t4)}
  ${xmlTag("E1", 0)}
  ${xmlTag("E2", 0)}
  ${xmlTag("ES1", 0)}
  ${xmlTag("ES2", 0)}
  ${xmlTag("NetVAT", netVat)}
  ${xmlTag("VATPayable", netVat >= 0 ? netVat : 0)}
  ${xmlTag("VATRefundable", netVat < 0 ? Math.abs(netVat) : 0)}
</VAT3>`;
}

/** Generate VAT3 XML and trigger download */
export function generateVATXml(data: VATReportData, options: VATXmlOptions): void {
  const xml = buildVATXml(data, options);
  const company = data.meta.companyName.replace(/\s+/g, "_");
  saveXml(xml, `VAT3_${company}_${data.meta.taxYear}.xml`);
}
