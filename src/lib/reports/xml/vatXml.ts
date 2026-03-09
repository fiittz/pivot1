import type { VATReportData } from "../types";
import { xmlDeclaration, xmlTag, xmlEl, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

export interface VATXmlOptions {
  vatNumber: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date

  // ── From onboarding_settings ──
  // EU trade flags — determines which boxes to populate
  euTradeEnabled?: boolean;
  sellsGoodsToEU?: boolean;
  buysGoodsFromEU?: boolean;
  sellsServicesToEU?: boolean;
  buysServicesFromEU?: boolean;
  sellsToNonEU?: boolean;
  buysFromNonEU?: boolean;
  sellsDigitalServicesB2C?: boolean;
  hasSection56Authorisation?: boolean;
  usesPostponedAccounting?: boolean;

  // ── Accountable person / company info ──
  companyName?: string;
  taxRefNo?: string;

  // ── Extended VAT boxes (T5-T10) ──
  // These can be populated from transaction analysis or questionnaire
  t5GoodsToEU?: number;       // T5: Goods dispatched/sold to other EU member states
  t6ServicesToEU?: number;    // T6: Services sold/supplied to other EU member states
  // E1/E2: Goods acquired from other EU member states
  e1GoodsFromEU?: number;
  e2VatOnGoodsFromEU?: number;
  // ES1/ES2: Services received from other EU member states
  es1ServicesFromEU?: number;
  es2VatOnServicesFromEU?: number;

  // ── Reason for submission ──
  reasonCode?: "normal" | "amended" | "supplementary";
}

/**
 * Build VAT3 XML string from report data.
 * Revenue VAT3 schema v1.5.
 *
 * Maps onboarding EU trade settings and transaction data to all Revenue boxes.
 * Boxes T1-T4: Standard sales/purchases
 * Boxes E1-E2: EU goods acquisitions
 * Boxes ES1-ES2: EU services acquisitions
 * Boxes T5-T6: EU dispatches/services supplied
 */
export function buildVATXml(data: VATReportData, options: VATXmlOptions): string {
  const t1 = wholeEuro(data.t1Sales);
  const t2 = wholeEuro(data.t2Vat);
  const t3 = wholeEuro(data.t3Purchases);
  const t4 = wholeEuro(data.t4InputVat);

  // EU trade boxes — populated from options or defaults to 0
  const e1 = wholeEuro(options.e1GoodsFromEU ?? 0);
  const e2 = wholeEuro(options.e2VatOnGoodsFromEU ?? 0);
  const es1 = wholeEuro(options.es1ServicesFromEU ?? 0);
  const es2 = wholeEuro(options.es2VatOnServicesFromEU ?? 0);
  const t5 = wholeEuro(options.t5GoodsToEU ?? 0);
  const t6 = wholeEuro(options.t6ServicesToEU ?? 0);

  // Net VAT = Output VAT (T2) + EU acquisition VAT (E2 + ES2) - Input VAT (T4)
  const netVat = t2 + e2 + es2 - t4;

  return `${xmlDeclaration()}
<VAT3 xmlns="http://www.ros.ie/schemas/vat3/" version="1.5">
  ${options.companyName ? xmlTag("AccountablePersonName", options.companyName) : ""}
  ${options.taxRefNo ? xmlTag("TaxRegistrationNumber", options.taxRefNo) : ""}
  ${xmlTag("VATNumber", options.vatNumber)}
  ${xmlTag("PeriodStart", fmtRevDate(options.periodStart))}
  ${xmlTag("PeriodEnd", fmtRevDate(options.periodEnd))}
  ${options.reasonCode ? xmlTag("ReasonForSubmission", options.reasonCode) : xmlTag("ReasonForSubmission", "normal")}
  ${xmlTag("T1", t1)}
  ${xmlTag("T2", t2)}
  ${xmlTag("T3", t3)}
  ${xmlTag("T4", t4)}
  ${xmlTag("T5", t5)}
  ${xmlTag("T6", t6)}
  ${xmlTag("E1", e1)}
  ${xmlTag("E2", e2)}
  ${xmlTag("ES1", es1)}
  ${xmlTag("ES2", es2)}
  ${xmlTag("NetVAT", netVat)}
  ${xmlTag("VATPayable", netVat >= 0 ? netVat : 0)}
  ${xmlTag("VATRefundable", netVat < 0 ? Math.abs(netVat) : 0)}
  ${options.hasSection56Authorisation ? xmlTag("Section56Authorisation", "true") : ""}
  ${options.usesPostponedAccounting ? xmlTag("PostponedAccounting", "true") : ""}
</VAT3>`;
}

/** Generate VAT3 XML and trigger download */
export function generateVATXml(data: VATReportData, options: VATXmlOptions): void {
  const xml = buildVATXml(data, options);
  const company = data.meta.companyName.replace(/\s+/g, "_");
  saveXml(xml, `VAT3_${company}_${data.meta.taxYear}.xml`);
}
