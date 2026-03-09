import jsPDF from "jspdf";

const MARGIN = 20;
const PAGE_WIDTH = 210; // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface SignaturePageOptions {
  companyName: string;
  companyNumber: string;
  financialYearEnd: string; // e.g. "2025-12-31"
  directorName: string;
  secretaryName: string;
  accountingFramework: "frs102_1a" | "frs102" | "frs105";
  auditExempt: boolean;
}

function formatYearEnd(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const FRAMEWORK_LABELS: Record<SignaturePageOptions["accountingFramework"], string> = {
  frs102_1a: "FRS 102 Section 1A (Small Entities)",
  frs102: "FRS 102 (Full)",
  frs105: "FRS 105 (Micro-entities)",
};

export function generateSignaturePage(options: SignaturePageOptions): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  let y = MARGIN + 5;

  // ─── Title ──────────────────────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATE OF DIRECTOR AND SECRETARY", PAGE_WIDTH / 2, y, {
    align: "center",
  });
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    "pursuant to Section 324(2) of the Companies Act 2014",
    PAGE_WIDTH / 2,
    y,
    { align: "center" },
  );
  y += 12;

  // ─── Separator ──────────────────────────────────────────────────────────────
  doc.setDrawColor(180);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // ─── Company details ───────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Company Name:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(options.companyName, MARGIN + 38, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text("Company Number:", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.text(options.companyNumber, MARGIN + 42, y);
  y += 14;

  // ─── Certification paragraph ───────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const certText =
    `We, the undersigned, being a Director and the Secretary of the above-named company, ` +
    `hereby certify that the financial statements for the financial year ended ` +
    `${formatYearEnd(options.financialYearEnd)} annexed hereto are true copies of those financial ` +
    `statements laid before the Annual General Meeting of the company (or, where applicable, ` +
    `to be laid before the next Annual General Meeting).`;

  const certLines = doc.splitTextToSize(certText, CONTENT_WIDTH);
  doc.text(certLines, MARGIN, y);
  y += certLines.length * 5 + 10;

  // ─── Accounting framework ─────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.text(
    "These financial statements have been prepared in accordance with:",
    MARGIN,
    y,
  );
  y += 8;

  doc.setFont("helvetica", "normal");
  const frameworks: SignaturePageOptions["accountingFramework"][] = [
    "frs102_1a",
    "frs102",
    "frs105",
  ];

  for (const fw of frameworks) {
    const isSelected = fw === options.accountingFramework;
    const checkbox = isSelected ? "\u2611" : "\u2610";
    doc.text(`${checkbox}  ${FRAMEWORK_LABELS[fw]}`, MARGIN + 4, y);
    y += 6;
  }
  y += 6;

  // ─── Audit exemption ───────────────────────────────────────────────────────
  if (options.auditExempt) {
    const auditText =
      `The company is entitled to the exemption from the obligation to have its financial ` +
      `statements audited, in accordance with Section 352 of the Companies Act 2014, and ` +
      `has availed of that exemption.`;

    const auditLines = doc.splitTextToSize(auditText, CONTENT_WIDTH);
    doc.text(auditLines, MARGIN, y);
    y += auditLines.length * 5 + 8;
  }

  // ─── Directors' responsibilities ───────────────────────────────────────────
  const respIntro =
    `The directors acknowledge their responsibilities under Sections 325 to 328 of the ` +
    `Companies Act 2014 for:`;
  const respIntroLines = doc.splitTextToSize(respIntro, CONTENT_WIDTH);
  doc.text(respIntroLines, MARGIN, y);
  y += respIntroLines.length * 5 + 4;

  const responsibilities = [
    "(a) keeping adequate accounting records;",
    "(b) preparing financial statements which give a true and fair view; and",
    "(c) selecting suitable accounting policies and applying them consistently.",
  ];

  for (const resp of responsibilities) {
    doc.text(resp, MARGIN + 6, y);
    y += 6;
  }
  y += 16;

  // ─── Director signature block ──────────────────────────────────────────────
  const sigLineWidth = 70;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + sigLineWidth, y);

  // Date line (right side)
  const dateX = PAGE_WIDTH - MARGIN - 40;
  doc.line(dateX, y, dateX + 35, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Director", MARGIN, y);
  doc.text("Date", dateX, y);
  y += 6;

  // Date format guide
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140);
  doc.text("___/___/_____", dateX, y);
  doc.setTextColor(0);

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Print Name: ${options.directorName}`, MARGIN, y);
  y += 20;

  // ─── Secretary signature block ─────────────────────────────────────────────
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + sigLineWidth, y);

  // Date line (right side)
  doc.line(dateX, y, dateX + 35, y);

  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Secretary", MARGIN, y);
  doc.text("Date", dateX, y);
  y += 6;

  // Date format guide
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140);
  doc.text("___/___/_____", dateX, y);
  doc.setTextColor(0);

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Print Name: ${options.secretaryName}`, MARGIN, y);

  // ─── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(
    "Generated by Balnce — AI-generated document, requires professional review.",
    MARGIN,
    290,
  );
  doc.text("Page 1 of 1", PAGE_WIDTH - MARGIN, 290, { align: "right" });
  doc.setTextColor(0);

  return doc;
}
