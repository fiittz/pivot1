import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock file-saver to prevent actual downloads ──────────────
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

import { saveAs } from "file-saver";
import { escXml, xmlTag, xmlDeclaration, wholeEuro, centEuro, fmtRevDate, saveXml } from "@/lib/reports/xmlHelpers";
import { buildVATXml, generateVATXml } from "@/lib/reports/xml/vatXml";
import { buildCT1Xml, generateCT1Xml } from "@/lib/reports/xml/ct1Xml";
import { buildForm11Xml, generateForm11Xml } from "@/lib/reports/xml/form11Xml";
import { buildRCTXml, generateRCTXml } from "@/lib/reports/xml/rctXml";
import type { VATReportData, CT1ReportData, Form11ReportData, ReportMeta } from "@/lib/reports/types";
import type { RCTSummary, RCTXmlOptions } from "@/lib/reports/xml/rctXml";

// ── Shared helpers ───────────────────────────────────────────

function makeMeta(overrides: Partial<ReportMeta> = {}): ReportMeta {
  return {
    companyName: "Test Company Ltd",
    taxYear: "2024",
    generatedDate: new Date("2024-12-31"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ================================================================
// XML Helpers
// ================================================================
describe("escXml", () => {
  it("escapes ampersand", () => {
    expect(escXml("A & B")).toBe("A &amp; B");
  });

  it("escapes angle brackets", () => {
    expect(escXml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes quotes", () => {
    expect(escXml(`He said "hello" & 'goodbye'`)).toBe(
      "He said &quot;hello&quot; &amp; &apos;goodbye&apos;",
    );
  });

  it("returns empty string unchanged", () => {
    expect(escXml("")).toBe("");
  });
});

describe("xmlTag", () => {
  it("wraps string value in tags", () => {
    expect(xmlTag("Name", "Test")).toBe("<Name>Test</Name>");
  });

  it("wraps number value in tags", () => {
    expect(xmlTag("Amount", 1234)).toBe("<Amount>1234</Amount>");
  });

  it("returns empty string for null", () => {
    expect(xmlTag("Name", null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(xmlTag("Name", undefined)).toBe("");
  });

  it("escapes special characters in string values", () => {
    expect(xmlTag("Name", "O'Brien & Co")).toBe("<Name>O&apos;Brien &amp; Co</Name>");
  });

  it("includes attributes when provided", () => {
    expect(xmlTag("Credit", 1875, { name: "Personal" })).toBe(
      '<Credit name="Personal">1875</Credit>',
    );
  });
});

describe("xmlDeclaration", () => {
  it("returns standard XML declaration", () => {
    expect(xmlDeclaration()).toBe('<?xml version="1.0" encoding="UTF-8"?>');
  });
});

describe("wholeEuro", () => {
  it("rounds to nearest integer", () => {
    expect(wholeEuro(1234.56)).toBe(1235);
    expect(wholeEuro(1234.49)).toBe(1234);
  });

  it("handles zero", () => {
    expect(wholeEuro(0)).toBe(0);
  });
});

describe("centEuro", () => {
  it("formats to two decimal places", () => {
    expect(centEuro(1234.5)).toBe("1234.50");
    expect(centEuro(0)).toBe("0.00");
  });
});

describe("fmtRevDate", () => {
  it("converts ISO date to DD/MM/YYYY", () => {
    expect(fmtRevDate("2024-01-15")).toBe("15/01/2024");
  });

  it("handles month and day padding", () => {
    expect(fmtRevDate("2024-03-05")).toBe("05/03/2024");
  });

  it("handles December 31st", () => {
    expect(fmtRevDate("2024-12-31")).toBe("31/12/2024");
  });
});

describe("saveXml", () => {
  it("calls saveAs with XML blob and filename", () => {
    saveXml("<root/>", "test.xml");
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "test.xml");
  });
});

// ================================================================
// VAT3 XML
// ================================================================
describe("buildVATXml", () => {
  function makeVATData(): VATReportData {
    return {
      meta: makeMeta(),
      sections: [],
      tables: [],
      t1Sales: 23000,
      t2Vat: 0,
      t3Purchases: 11500,
      t4InputVat: 0,
      netVat: 11500,
    };
  }

  const vatOptions = {
    vatNumber: "IE1234567T",
    periodStart: "2024-01-01",
    periodEnd: "2024-06-30",
  };

  it("includes XML declaration", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("has VAT3 root element with namespace", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain('<VAT3 xmlns="http://www.revenue.ie/schemas/vat3"');
    expect(xml).toContain("</VAT3>");
  });

  it("maps T1-T4 fields correctly", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain("<T1>23000</T1>");
    expect(xml).toContain("<T2>0</T2>");
    expect(xml).toContain("<T3>11500</T3>");
    expect(xml).toContain("<T4>0</T4>");
  });

  it("includes VAT number", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain("<VATNumber>IE1234567T</VATNumber>");
  });

  it("formats period dates as DD/MM/YYYY", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain("<PeriodStart>01/01/2024</PeriodStart>");
    expect(xml).toContain("<PeriodEnd>30/06/2024</PeriodEnd>");
  });

  it("defaults EU fields to 0", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain("<E1>0</E1>");
    expect(xml).toContain("<E2>0</E2>");
    expect(xml).toContain("<ES1>0</ES1>");
    expect(xml).toContain("<ES2>0</ES2>");
  });

  it("sets VATPayable when net is positive", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain("<VATPayable>11500</VATPayable>");
    expect(xml).toContain("<VATRefundable>0</VATRefundable>");
  });

  it("sets VATRefundable when net is negative", () => {
    const data = makeVATData();
    data.netVat = -5000;
    const xml = buildVATXml(data, vatOptions);
    expect(xml).toContain("<VATPayable>0</VATPayable>");
    expect(xml).toContain("<VATRefundable>5000</VATRefundable>");
  });
});

describe("generateVATXml", () => {
  it("calls saveAs with correct filename", () => {
    const data: VATReportData = {
      meta: makeMeta(),
      sections: [],
      tables: [],
      t1Sales: 1000,
      t2Vat: 0,
      t3Purchases: 500,
      t4InputVat: 0,
      netVat: 500,
    };
    generateVATXml(data, { vatNumber: "IE123", periodStart: "2024-01-01", periodEnd: "2024-06-30" });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "VAT3_Test_Company_Ltd_2024.xml");
  });
});

// ================================================================
// CT1 XML
// ================================================================
describe("buildCT1Xml", () => {
  function makeCT1Data(): CT1ReportData {
    return {
      meta: makeMeta(),
      sections: [],
      tables: [],
      totalCTLiability: 8750,
      tradingProfit: 70000,
      totalIncome: 100000,
      totalDeductions: 30000,
    };
  }

  const ct1Options = {
    periodStart: "2024-01-01",
    periodEnd: "2024-12-31",
    companyRegNo: "123456",
    taxRefNo: "1234567T",
    isCloseCompany: false,
    preliminaryCTPaid: 5000,
    rctCredit: 0,
  };

  it("includes XML declaration", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("has FormCt1 root with currency and formversion", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('<FormCt1 xmlns="http://www.revenue.ie/schemas/ct1" currency="E" formversion="25">');
    expect(xml).toContain("</FormCt1>");
  });

  it("maps trading income fields", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain("<TotalTradingIncome>100000</TotalTradingIncome>");
    expect(xml).toContain("<AllowableDeductions>30000</AllowableDeductions>");
    expect(xml).toContain("<TradingProfit>70000</TradingProfit>");
  });

  it("includes CT computation", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain("<CTRate>12.5</CTRate>");
    expect(xml).toContain("<TotalCTLiability>8750</TotalCTLiability>");
  });

  it("calculates balance due correctly", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    // 8750 - 5000 - 0 = 3750
    expect(xml).toContain("<BalanceDue>3750</BalanceDue>");
  });

  it("omits close company surcharge when not applicable", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).not.toContain("<CloseCompanySurcharge>");
  });

  it("includes close company surcharge when applicable", () => {
    const data = makeCT1Data();
    data.totalCTLiability = 10750; // 8750 CT + 2000 surcharge
    const xml = buildCT1Xml(data, { ...ct1Options, isCloseCompany: true });
    expect(xml).toContain("<CloseCompanySurcharge>");
    expect(xml).toContain("<SurchargeApplicable>Y</SurchargeApplicable>");
    expect(xml).toContain("<SurchargeAmount>2000</SurchargeAmount>");
  });

  it("includes company identifiers", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain("<CompanyRegNo>123456</CompanyRegNo>");
    expect(xml).toContain("<TaxRefNo>1234567T</TaxRefNo>");
  });
});

describe("generateCT1Xml", () => {
  it("calls saveAs with correct filename", () => {
    const data: CT1ReportData = {
      meta: makeMeta(),
      sections: [],
      tables: [],
      totalCTLiability: 8750,
      tradingProfit: 70000,
      totalIncome: 100000,
      totalDeductions: 30000,
    };
    generateCT1Xml(data, {
      periodStart: "2024-01-01",
      periodEnd: "2024-12-31",
      companyRegNo: "123456",
      taxRefNo: "1234567T",
      isCloseCompany: false,
    });
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "CT1_Test_Company_Ltd_2024.xml");
  });
});

// ================================================================
// Form 11 XML
// ================================================================
describe("buildForm11Xml", () => {
  function makeForm11Data(): Form11ReportData {
    return {
      meta: makeMeta(),
      sections: [],
      tables: [],
      input: {
        directorName: "Alice Murphy",
        ppsNumber: "1234567T",
        dateOfBirth: "1985-01-01",
        maritalStatus: "single",
        assessmentBasis: "single",
        salary: 50000,
        dividends: 5000,
        bik: 2000,
        businessIncome: 100000,
        businessExpenses: 30000,
        capitalAllowances: 5000,
        rentalIncome: 0,
        rentalExpenses: 0,
        foreignIncome: 0,
        otherIncome: 0,
        capitalGains: 0,
        capitalLosses: 0,
        pensionContributions: 10000,
        medicalExpenses: 2000,
        rentPaid: 0,
        charitableDonations: 500,
        remoteWorkingCosts: 0,
        spouseIncome: 0,
        claimHomeCarer: false,
        claimSingleParent: false,
        hasPAYEIncome: true,
        mileageAllowance: 1200,
        preliminaryTaxPaid: 15000,
      },
      result: {
        scheduleE: 57000,
        scheduleD: 65000,
        rentalProfit: 0,
        foreignIncome: 0,
        otherIncome: 0,
        spouseIncome: 0,
        totalGrossIncome: 122000,
        pensionRelief: 10000,
        pensionAgeLimit: 0.2,
        totalDeductions: 10000,
        assessableIncome: 112000,
        incomeTaxBands: [
          { label: "Standard", amount: 42000, rate: 0.2, tax: 8400 },
          { label: "Higher", amount: 70000, rate: 0.4, tax: 28000 },
        ],
        grossIncomeTax: 36400,
        credits: [
          { label: "Personal", amount: 1875 },
          { label: "PAYE", amount: 1875 },
          { label: "Earned Income", amount: 1875 },
        ],
        totalCredits: 5625,
        netIncomeTax: 30775,
        uscBands: [
          { label: "Band 1", amount: 12012, rate: 0.005, tax: 60 },
          { label: "Band 2", amount: 13748, rate: 0.02, tax: 275 },
        ],
        totalUSC: 335,
        uscExempt: false,
        prsiAssessable: 112000,
        prsiCalculated: 4592,
        prsiPayable: 4592,
        cgtApplicable: false,
        cgtGains: 0,
        cgtLosses: 0,
        cgtExemption: 1270,
        cgtPayable: 0,
        totalLiability: 35702,
        preliminaryTaxPaid: 15000,
        balanceDue: 20702,
        splitYearApplied: false,
        splitYearNote: "",
        warnings: [],
        notes: [],
      },
    };
  }

  it("includes XML declaration", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("has Form11 root with formversion and period", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('<Form11 xmlns="http://www.revenue.ie/schemas/form11" formversion="26"');
    expect(xml).toContain('periodstart="01/01/2024"');
    expect(xml).toContain('periodend="31/12/2024"');
  });

  it("maps personal details correctly", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<PPSN>1234567T</PPSN>");
    expect(xml).toContain("<FirstName>Alice</FirstName>");
    expect(xml).toContain("<Surname>Murphy</Surname>");
    expect(xml).toContain("<MaritalStatus>S</MaritalStatus>");
  });

  it("maps marital status codes", () => {
    const data = makeForm11Data();
    data.input.maritalStatus = "married";
    expect(buildForm11Xml(data)).toContain("<MaritalStatus>M</MaritalStatus>");

    data.input.maritalStatus = "civil_partner";
    expect(buildForm11Xml(data)).toContain("<MaritalStatus>C</MaritalStatus>");

    data.input.maritalStatus = "widowed";
    expect(buildForm11Xml(data)).toContain("<MaritalStatus>W</MaritalStatus>");

    data.input.maritalStatus = "separated";
    expect(buildForm11Xml(data)).toContain("<MaritalStatus>P</MaritalStatus>");
  });

  it("includes PAYE section", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<Salary>50000</Salary>");
    expect(xml).toContain("<Dividends>5000</Dividends>");
    expect(xml).toContain("<BenefitInKind>2000</BenefitInKind>");
    expect(xml).toContain("<MileageAllowance>1200</MileageAllowance>");
  });

  it("includes trade section", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<GrossIncome>100000</GrossIncome>");
    expect(xml).toContain("<AllowableExpenses>30000</AllowableExpenses>");
    expect(xml).toContain("<CapitalAllowances>5000</CapitalAllowances>");
    expect(xml).toContain("<ScheduleD>65000</ScheduleD>");
  });

  it("omits rental section when no rental income", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).not.toContain("<RentalIncome>");
  });

  it("includes rental section when rental income exists", () => {
    const data = makeForm11Data();
    data.input.rentalIncome = 12000;
    data.input.rentalExpenses = 3000;
    data.result.rentalProfit = 9000;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<RentalIncome>");
    expect(xml).toContain("<GrossRental>12000</GrossRental>");
    expect(xml).toContain("<NetRentalProfit>9000</NetRentalProfit>");
  });

  it("omits CGT section when not applicable", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).not.toContain("<CapitalGains>");
  });

  it("includes CGT section when applicable", () => {
    const data = makeForm11Data();
    data.result.cgtApplicable = true;
    data.result.cgtGains = 50000;
    data.result.cgtPayable = 16091;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<CapitalGains>");
    expect(xml).toContain("<TotalGains>50000</TotalGains>");
    expect(xml).toContain("<CGTPayable>16091</CGTPayable>");
  });

  it("includes income tax bands", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<Amount>42000</Amount>");
    expect(xml).toContain("<Rate>20.0</Rate>");
    expect(xml).toContain("<Tax>8400</Tax>");
  });

  it("includes tax credits with name attribute", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('<Credit name="Personal">1875</Credit>');
    expect(xml).toContain('<Credit name="PAYE">1875</Credit>');
  });

  it("includes USC section", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<Exempt>N</Exempt>");
    expect(xml).toContain("<TotalUSC>335</TotalUSC>");
  });

  it("marks USC exempt when applicable", () => {
    const data = makeForm11Data();
    data.result.uscExempt = true;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<Exempt>Y</Exempt>");
  });

  it("includes summary totals", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<TotalLiability>35702</TotalLiability>");
    expect(xml).toContain("<PreliminaryTaxPaid>15000</PreliminaryTaxPaid>");
    expect(xml).toContain("<BalanceDue>20702</BalanceDue>");
  });
});

describe("generateForm11Xml", () => {
  it("calls saveAs with director name in filename", () => {
    const data: Form11ReportData = {
      meta: makeMeta(),
      sections: [],
      tables: [],
      input: {
        directorName: "Alice Murphy",
        ppsNumber: "1234567T",
        dateOfBirth: "1985-01-01",
        maritalStatus: "single",
        assessmentBasis: "single",
        salary: 0,
        dividends: 0,
        bik: 0,
        businessIncome: 0,
        businessExpenses: 0,
        capitalAllowances: 0,
        rentalIncome: 0,
        rentalExpenses: 0,
        foreignIncome: 0,
        otherIncome: 0,
        capitalGains: 0,
        capitalLosses: 0,
        pensionContributions: 0,
        medicalExpenses: 0,
        rentPaid: 0,
        charitableDonations: 0,
        remoteWorkingCosts: 0,
        spouseIncome: 0,
        claimHomeCarer: false,
        claimSingleParent: false,
        hasPAYEIncome: false,
        mileageAllowance: 0,
        preliminaryTaxPaid: 0,
      },
      result: {
        scheduleE: 0,
        scheduleD: 0,
        rentalProfit: 0,
        foreignIncome: 0,
        otherIncome: 0,
        spouseIncome: 0,
        totalGrossIncome: 0,
        pensionRelief: 0,
        pensionAgeLimit: 0.15,
        totalDeductions: 0,
        assessableIncome: 0,
        incomeTaxBands: [],
        grossIncomeTax: 0,
        credits: [],
        totalCredits: 0,
        netIncomeTax: 0,
        uscBands: [],
        totalUSC: 0,
        uscExempt: true,
        prsiAssessable: 0,
        prsiCalculated: 0,
        prsiPayable: 0,
        cgtApplicable: false,
        cgtGains: 0,
        cgtLosses: 0,
        cgtExemption: 1270,
        cgtPayable: 0,
        totalLiability: 0,
        preliminaryTaxPaid: 0,
        balanceDue: 0,
        splitYearApplied: false,
        splitYearNote: "",
        warnings: [],
        notes: [],
      },
    };
    generateForm11Xml(data);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "Form11_Alice_Murphy_2024.xml");
  });
});

// ================================================================
// RCT XML (Stub)
// ================================================================
describe("buildRCTXml", () => {
  function makeRCTData(): { summary: RCTSummary; options: RCTXmlOptions } {
    return {
      summary: {
        totalGrossPayments: 50000,
        totalTaxDeducted: 10000,
        subcontractors: [
          {
            taxRef: "9876543W",
            name: "Bob Builder",
            grossPayment: 30000,
            taxDeducted: 6000,
            rctRate: 20,
          },
          {
            taxRef: "1111111A",
            name: "Sam Smith",
            grossPayment: 20000,
            taxDeducted: 4000,
            rctRate: 20,
          },
        ],
      },
      options: {
        principalTaxRef: "1234567T",
        principalName: "Construction Co Ltd",
        month: 3,
        year: 2024,
      },
    };
  }

  it("includes XML declaration", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("has FormRCT root element", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<FormRCT");
    expect(xml).toContain("</FormRCT>");
  });

  it("includes principal details", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<Principal>");
    expect(xml).toContain("<TaxRef>1234567T</TaxRef>");
    expect(xml).toContain("<Name>Construction Co Ltd</Name>");
  });

  it("includes period in MM/YYYY format", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<Period>03/2024</Period>");
  });

  it("lists subcontractors", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<Subcontractor>");
    expect(xml).toContain("<Name>Bob Builder</Name>");
    expect(xml).toContain("<Name>Sam Smith</Name>");
  });

  it("uses cent precision for monetary values", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<GrossPayment>30000.00</GrossPayment>");
    expect(xml).toContain("<TaxDeducted>6000.00</TaxDeducted>");
    expect(xml).toContain("<TotalGrossPayments>50000.00</TotalGrossPayments>");
  });

  it("includes subcontractor count in summary", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain("<SubcontractorCount>2</SubcontractorCount>");
  });
});

describe("generateRCTXml", () => {
  it("calls saveAs with correct filename", () => {
    generateRCTXml(
      { totalGrossPayments: 0, totalTaxDeducted: 0, subcontractors: [] },
      { principalTaxRef: "123", principalName: "Test Co", month: 1, year: 2024 },
    );
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), "RCT_Test_Co_2024_01.xml");
  });
});
