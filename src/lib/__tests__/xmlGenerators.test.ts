import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock file-saver to prevent actual downloads ──────────────
vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

import { saveAs } from "file-saver";
import { escXml, xmlTag, xmlDeclaration, wholeEuro, centEuro, fmtRevDate, saveXml, xmlEl } from "@/lib/reports/xmlHelpers";
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

describe("xmlEl", () => {
  it("generates self-closing element with attributes", () => {
    expect(xmlEl("TradeProfits", { profityear: 70000 })).toBe(
      '<TradeProfits profityear="70000"/>',
    );
  });

  it("handles multiple attributes", () => {
    const result = xmlEl("Details", { surname: "Murphy", firstname: "Alice" });
    expect(result).toContain('surname="Murphy"');
    expect(result).toContain('firstname="Alice"');
    expect(result).toMatch(/^<Details .+\/>$/);
  });

  it("omits null values", () => {
    expect(xmlEl("Test", { a: "1", b: null })).toBe('<Test a="1"/>');
  });

  it("omits undefined values", () => {
    expect(xmlEl("Test", { a: "1", b: undefined })).toBe('<Test a="1"/>');
  });

  it("returns empty string when all values are null/undefined", () => {
    expect(xmlEl("Test", { a: null, b: undefined })).toBe("");
  });

  it("escapes special characters in attribute values", () => {
    expect(xmlEl("Co", { name: "O'Brien & Co" })).toBe(
      '<Co name="O&apos;Brien &amp; Co"/>',
    );
  });

  it("handles boolean values", () => {
    expect(xmlEl("Flag", { active: true })).toBe('<Flag active="true"/>');
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

  it("has VAT3 root element with correct namespace", () => {
    const xml = buildVATXml(makeVATData(), vatOptions);
    expect(xml).toContain('<VAT3 xmlns="http://www.ros.ie/schemas/vat3/"');
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
    companyName: "Test Company Ltd",
    isCloseCompany: false,
    preliminaryCTPaid: 5000,
    rctCredit: 0,
  };

  it("includes XML declaration", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("has FormCt1 root with correct namespace, currency, formversion and language", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('<FormCt1 xmlns="http://www.ros.ie/schemas/formct1/v25/"');
    expect(xml).toContain('currency="E"');
    expect(xml).toContain('formversion="25"');
    expect(xml).toContain('language="EN"');
    expect(xml).toContain("</FormCt1>");
  });

  it("includes CompanyDetails with referencenumber and companyname attributes", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('referencenumber="1234567T"');
    expect(xml).toContain('companyname="Test Company Ltd"');
  });

  it("includes TradingResults with TradeProfits", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('<TradeProfits profityear="70000"/>');
  });

  it("includes SelfAssessmentCt with tax figures", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('selfTaxCharge="8750"');
    expect(xml).toContain('selfAmtTaxPaidDirect="5000"');
    expect(xml).toContain('selfBalanceTaxPayable="3750"');
    expect(xml).toContain('declareSelfAssessment="true"');
  });

  it("includes SummaryCalculation with totals", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('tradingIncome="100000"');
    expect(xml).toContain('totalIncome="100000"');
    expect(xml).toContain('totalDeductions="30000"');
    expect(xml).toContain('totalTax="8750"');
    expect(xml).toContain('totalAmountPayable="3750"');
  });

  it("includes TaxableIncomeAtRate for 12.5% trading rate", () => {
    const xml = buildCT1Xml(makeCT1Data(), ct1Options);
    expect(xml).toContain('amountChargeableAtRate="70000"');
    expect(xml).toContain('percentageRate="12.5"');
    expect(xml).toContain('amountPayableAtRate="8750"');
    expect(xml).toContain('taxIdentifier="Trading"');
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
    expect(xml).toContain('section440="2000"');
  });

  it("supports custom language option", () => {
    const xml = buildCT1Xml(makeCT1Data(), { ...ct1Options, language: "GA" });
    expect(xml).toContain('language="GA"');
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
      companyName: "Test Company Ltd",
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

  it("has Form11 root with correct namespace, currency, formversion and language", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('<Form11 xmlns="http://www.ros.ie/schemas/form11/v26/"');
    expect(xml).toContain('currency="E"');
    expect(xml).toContain('formversion="26"');
    expect(xml).toContain('language="EN"');
    expect(xml).toContain('periodstart="01/01/2024"');
    expect(xml).toContain('periodend="31/12/2024"');
    expect(xml).toContain("</Form11>");
  });

  it("includes Personal Details with attribute-based elements", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('surname="Murphy"');
    expect(xml).toContain('firstname="Alice"');
    expect(xml).toContain('ppsnself="1234567T"');
  });

  it("uses numeric marital status codes", () => {
    const data = makeForm11Data();
    expect(buildForm11Xml(data)).toContain('status="1"');

    data.input.maritalStatus = "married";
    expect(buildForm11Xml(data)).toContain('status="2"');

    data.input.maritalStatus = "civil_partner";
    expect(buildForm11Xml(data)).toContain('status="3"');

    data.input.maritalStatus = "widowed";
    expect(buildForm11Xml(data)).toContain('status="4"');

    data.input.maritalStatus = "separated";
    expect(buildForm11Xml(data)).toContain('status="5"');
  });

  it("includes Trade section with TradeInfo and TradeCapital", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('tradeno="1"');
    expect(xml).toContain('profityear="65000"');
    expect(xml).toContain('adjustednetprofit="65000"');
    expect(xml).toContain('machinery="5000"');
  });

  it("includes Paye Employments with amtit", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('amtit="57000"');
  });

  it("includes BenefitInKind", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('otheramtself="2000"');
  });

  it("omits rental section when no rental income", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).not.toContain("<Rental>");
  });

  it("includes rental section when rental income exists", () => {
    const data = makeForm11Data();
    data.input.rentalIncome = 12000;
    data.input.rentalExpenses = 3000;
    data.result.rentalProfit = 9000;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<Rental>");
    expect(xml).toContain('rentself="12000"');
    expect(xml).toContain('netrentself="9000"');
  });

  it("omits CGT section when not applicable", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).not.toContain("<CapitalGains>");
  });

  it("includes CGT section when applicable", () => {
    const data = makeForm11Data();
    data.result.cgtApplicable = true;
    data.result.cgtGains = 50000;
    data.result.cgtLosses = 0;
    data.result.cgtExemption = 1270;
    data.result.cgtPayable = 16091;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<CapitalGains>");
    expect(xml).toContain('gainself="50000"');
    expect(xml).toContain('chargeablegainself="48730"');
  });

  it("includes charitable donations in ChargesDeductions", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('payment="500"');
  });

  it("uses empty ChargesDeductions when no donations", () => {
    const data = makeForm11Data();
    data.input.charitableDonations = 0;
    const xml = buildForm11Xml(data);
    expect(xml).toContain("<ChargesDeductions/>");
  });

  it("includes SelfAssessmentIT with all tax figures", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain('selfamtincomeorprofit="112000"');
    expect(xml).toContain('selfincometaxcharge="30775"');
    expect(xml).toContain('selfusccharge="335"');
    expect(xml).toContain('selfprsicharge="4592"');
    expect(xml).toContain('selftotaltaxcharge="35702"');
    expect(xml).toContain('selfamttaxpayable="35702"');
    expect(xml).toContain('selfamttaxpaiddirect="15000"');
    expect(xml).toContain('selfbalancetaxpayable="20702"');
    expect(xml).toContain('declareselfassessment="true"');
  });

  it("includes SummaryCalculation Income breakdown", () => {
    const xml = buildForm11Xml(makeForm11Data());
    expect(xml).toContain("<SummaryCalculation>");
    expect(xml).toContain("<Income>");
    expect(xml).toContain('description="Trade 1"');
    expect(xml).toContain('amount="65000"');
    // Emoluments
    expect(xml).toMatch(/Emoluments.*amount="57000"/);
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

  it("has FormRCT root element with correct namespace", () => {
    const { summary, options } = makeRCTData();
    const xml = buildRCTXml(summary, options);
    expect(xml).toContain('<FormRCT xmlns="http://www.ros.ie/schemas/rct/"');
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
