import { xmlDeclaration, xmlTag, centEuro, fmtRevDate, saveXml } from "../xmlHelpers";

// ── Local RCT types (no RCT data tracking in codebase yet) ──

export interface RCTSubcontractor {
  taxRef: string;
  name: string;
  grossPayment: number;
  taxDeducted: number;
  rctRate: number; // 0, 20, or 35
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
}

/**
 * Build RCT XML string from summary data.
 * This is a forward-looking stub — UI wiring deferred until RCT data tracking is built.
 */
export function buildRCTXml(summary: RCTSummary, options: RCTXmlOptions): string {
  const mm = String(options.month).padStart(2, "0");
  const periodStr = `${mm}/${options.year}`;

  const subcontractorLines = summary.subcontractors
    .map(
      (sc) => `  <Subcontractor>
    ${xmlTag("TaxRef", sc.taxRef)}
    ${xmlTag("Name", sc.name)}
    ${xmlTag("GrossPayment", centEuro(sc.grossPayment))}
    ${xmlTag("TaxDeducted", centEuro(sc.taxDeducted))}
    ${xmlTag("RCTRate", sc.rctRate)}
  </Subcontractor>`,
    )
    .join("\n");

  return `${xmlDeclaration()}
<FormRCT xmlns="http://www.ros.ie/schemas/rct/">
  <Principal>
    ${xmlTag("TaxRef", options.principalTaxRef)}
    ${xmlTag("Name", options.principalName)}
  </Principal>
  ${xmlTag("Period", periodStr)}
${subcontractorLines}
  <Summary>
    ${xmlTag("TotalGrossPayments", centEuro(summary.totalGrossPayments))}
    ${xmlTag("TotalTaxDeducted", centEuro(summary.totalTaxDeducted))}
    ${xmlTag("SubcontractorCount", summary.subcontractors.length)}
  </Summary>
</FormRCT>`;
}

/** Generate RCT XML and trigger download */
export function generateRCTXml(summary: RCTSummary, options: RCTXmlOptions): void {
  const xml = buildRCTXml(summary, options);
  const name = options.principalName.replace(/\s+/g, "_");
  const mm = String(options.month).padStart(2, "0");
  saveXml(xml, `RCT_${name}_${options.year}_${mm}.xml`);
}
