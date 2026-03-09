import { xmlDeclaration, xmlTag, xmlEl, centEuro, fmtRevDate, saveXml } from "../xmlHelpers";

// ── RCT Types ──

export interface RCTSubcontractor {
  taxRef: string;
  name: string;
  grossPayment: number;
  taxDeducted: number;
  rctRate: number; // 0, 20, or 35
  contractRef?: string;         // eRCT contract reference
  paymentDate?: string;         // ISO date
  paymentNotificationRef?: string; // eRCT deduction authorisation ref
}

export interface RCTSummary {
  totalGrossPayments: number;
  totalTaxDeducted: number;
  subcontractors: RCTSubcontractor[];
}

export interface RCTXmlOptions {
  principalTaxRef: string;
  principalName: string;
  month: number; // 1-12
  year: number;

  // ── From eRCT system ──
  principalCRO?: string;
  principalVATNumber?: string;
  isMonthlyReturn?: boolean;     // monthly vs quarterly

  // ── Declaration ──
  declarationName?: string;      // person signing off
  declarationPosition?: string;  // e.g. "Director"
  declarationDate?: string;      // ISO date
}

/**
 * Build RCT XML string from summary data.
 * Revenue RCT schema — maps eRCT payment notifications and contract data.
 *
 * Each subcontractor entry maps to an eRCT deduction authorisation.
 * The summary totals should reconcile with Revenue's eRCT records.
 */
export function buildRCTXml(summary: RCTSummary, options: RCTXmlOptions): string {
  const mm = String(options.month).padStart(2, "0");
  const periodStr = `${mm}/${options.year}`;

  const subcontractorLines = summary.subcontractors
    .map(
      (sc) => `  <Subcontractor>
    ${xmlTag("TaxRef", sc.taxRef)}
    ${xmlTag("Name", sc.name)}
    ${sc.contractRef ? xmlTag("ContractRef", sc.contractRef) : ""}
    ${sc.paymentDate ? xmlTag("PaymentDate", fmtRevDate(sc.paymentDate)) : ""}
    ${sc.paymentNotificationRef ? xmlTag("PaymentNotificationRef", sc.paymentNotificationRef) : ""}
    ${xmlTag("GrossPayment", centEuro(sc.grossPayment))}
    ${xmlTag("TaxDeducted", centEuro(sc.taxDeducted))}
    ${xmlTag("RCTRate", sc.rctRate)}
  </Subcontractor>`,
    )
    .join("\n");

  // Declaration section
  let declarationSection = "";
  if (options.declarationName) {
    declarationSection = `
  <Declaration>
    ${xmlTag("Name", options.declarationName)}
    ${options.declarationPosition ? xmlTag("Position", options.declarationPosition) : ""}
    ${options.declarationDate ? xmlTag("Date", fmtRevDate(options.declarationDate)) : ""}
  </Declaration>`;
  }

  return `${xmlDeclaration()}
<FormRCT xmlns="http://www.ros.ie/schemas/rct/" version="1.0">
  <Principal>
    ${xmlTag("TaxRef", options.principalTaxRef)}
    ${xmlTag("Name", options.principalName)}
    ${options.principalCRO ? xmlTag("CRONumber", options.principalCRO) : ""}
    ${options.principalVATNumber ? xmlTag("VATNumber", options.principalVATNumber) : ""}
  </Principal>
  ${xmlTag("Period", periodStr)}
  ${xmlTag("ReturnType", options.isMonthlyReturn === false ? "quarterly" : "monthly")}
${subcontractorLines}
  <Summary>
    ${xmlTag("TotalGrossPayments", centEuro(summary.totalGrossPayments))}
    ${xmlTag("TotalTaxDeducted", centEuro(summary.totalTaxDeducted))}
    ${xmlTag("SubcontractorCount", summary.subcontractors.length)}
    ${xmlTag("NetTaxRate0Count", summary.subcontractors.filter(s => s.rctRate === 0).length)}
    ${xmlTag("NetTaxRate20Count", summary.subcontractors.filter(s => s.rctRate === 20).length)}
    ${xmlTag("NetTaxRate35Count", summary.subcontractors.filter(s => s.rctRate === 35).length)}
  </Summary>${declarationSection}
</FormRCT>`;
}

/** Generate RCT XML and trigger download */
export function generateRCTXml(summary: RCTSummary, options: RCTXmlOptions): void {
  const xml = buildRCTXml(summary, options);
  const name = options.principalName.replace(/\s+/g, "_");
  const mm = String(options.month).padStart(2, "0");
  saveXml(xml, `RCT_${name}_${options.year}_${mm}.xml`);
}
