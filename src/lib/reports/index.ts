// Types
export type {
  ReportMeta,
  ReportSection,
  ReportTable,
  CT1ReportData,
  Form11ReportData,
  VATReportData,
  BalanceSheetReportData,
  AbridgedAccountsReportData,
} from "./types";

// Formatters
export { fmtEuro, fmtDate, fmtPercent, fmtTaxYear } from "./formatters";

// Data Assembly
export { assembleCT1ReportData } from "./ct1ReportData";
export { assembleForm11ReportData } from "./form11ReportData";
export type { Form11ReportOptions } from "./form11ReportData";
export { assembleVATReportData } from "./vatReportData";
export type { VATInput } from "./vatReportData";
export { assembleBalanceSheetData } from "./balanceSheetData";
export type { BalanceSheetInput } from "./balanceSheetData";
export { assembleAbridgedAccountsData } from "./abridgedAccountsData";
export type { AbridgedAccountsInput } from "./abridgedAccountsData";

// PDF Generators
export { generateCT1Pdf } from "./pdf/ct1Pdf";
export { generateForm11Pdf } from "./pdf/form11Pdf";
export { generateVATPdf } from "./pdf/vatPdf";
export { generateBalanceSheetPdf } from "./pdf/balanceSheetPdf";
export { generateAbridgedAccountsPdf } from "./pdf/abridgedAccountsPdf";

// Excel Generators
export { generateCT1Excel } from "./excel/ct1Excel";
export { generateForm11Excel } from "./excel/form11Excel";
export { generateVATExcel } from "./excel/vatExcel";
export { generateBalanceSheetExcel } from "./excel/balanceSheetExcel";
export { generateAbridgedAccountsExcel } from "./excel/abridgedAccountsExcel";

// XML Generators (ROS Upload)
export { generateVATXml, buildVATXml } from "./xml/vatXml";
export { generateCT1Xml, buildCT1Xml } from "./xml/ct1Xml";
export { generateForm11Xml, buildForm11Xml } from "./xml/form11Xml";
export { generateRCTXml, buildRCTXml } from "./xml/rctXml";
