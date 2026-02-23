import type { Form11ReportData } from "../types";
import { xmlDeclaration, xmlTag, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

const MARITAL_STATUS_CODES: Record<string, string> = {
  single: "S",
  married: "M",
  civil_partner: "C",
  widowed: "W",
  separated: "P",
};

/**
 * Build Form 11 XML string from report data.
 * Revenue Form11 schema — formversion 26.
 */
export function buildForm11Xml(data: Form11ReportData): string {
  const { input, result } = data;
  const taxYear = data.meta.taxYear;
  const periodStart = `01/01/${taxYear}`;
  const periodEnd = `31/12/${taxYear}`;
  const maritalCode = MARITAL_STATUS_CODES[input.maritalStatus] ?? "S";

  // Income tax bands
  const bandLines = result.incomeTaxBands
    .map(
      (b) => `    <Band>
      ${xmlTag("Amount", wholeEuro(b.amount))}
      ${xmlTag("Rate", (b.rate * 100).toFixed(1))}
      ${xmlTag("Tax", wholeEuro(b.tax))}
    </Band>`,
    )
    .join("\n");

  // Tax credits
  const creditLines = result.credits
    .map((c) => `    ${xmlTag("Credit", wholeEuro(c.amount), { name: c.label })}`)
    .join("\n");

  // USC bands
  const uscLines = result.uscBands
    .map(
      (b) => `    <Band>
      ${xmlTag("Amount", wholeEuro(b.amount))}
      ${xmlTag("Rate", (b.rate * 100).toFixed(2))}
      ${xmlTag("Tax", wholeEuro(b.tax))}
    </Band>`,
    )
    .join("\n");

  // Conditional sections
  let rentalSection = "";
  if (result.rentalProfit > 0 || input.rentalIncome > 0) {
    rentalSection = `
  <RentalIncome>
    ${xmlTag("GrossRental", wholeEuro(input.rentalIncome))}
    ${xmlTag("RentalExpenses", wholeEuro(input.rentalExpenses))}
    ${xmlTag("NetRentalProfit", wholeEuro(result.rentalProfit))}
  </RentalIncome>`;
  }

  let cgtSection = "";
  if (result.cgtApplicable) {
    cgtSection = `
  <CapitalGains>
    ${xmlTag("TotalGains", wholeEuro(result.cgtGains))}
    ${xmlTag("AllowableLosses", wholeEuro(result.cgtLosses))}
    ${xmlTag("AnnualExemption", wholeEuro(result.cgtExemption))}
    ${xmlTag("CGTPayable", wholeEuro(result.cgtPayable))}
  </CapitalGains>`;
  }

  return `${xmlDeclaration()}
<Form11 xmlns="http://www.revenue.ie/schemas/form11" formversion="26" periodstart="${periodStart}" periodend="${periodEnd}">
  <Personal>
    ${xmlTag("PPSN", input.ppsNumber)}
    ${xmlTag("FirstName", input.directorName.split(" ")[0] ?? "")}
    ${xmlTag("Surname", input.directorName.split(" ").slice(1).join(" "))}
    ${xmlTag("MaritalStatus", maritalCode)}
    ${xmlTag("AssessmentBasis", input.assessmentBasis)}
  </Personal>
  <Paye>
    ${xmlTag("Salary", wholeEuro(input.salary))}
    ${xmlTag("Dividends", wholeEuro(input.dividends))}
    ${xmlTag("BenefitInKind", wholeEuro(input.bik))}
    ${xmlTag("MileageAllowance", wholeEuro(input.mileageAllowance))}
    ${xmlTag("ScheduleE", wholeEuro(result.scheduleE))}
  </Paye>
  <Trade>
    ${xmlTag("GrossIncome", wholeEuro(input.businessIncome))}
    ${xmlTag("AllowableExpenses", wholeEuro(input.businessExpenses))}
    ${xmlTag("CapitalAllowances", wholeEuro(input.capitalAllowances))}
    ${xmlTag("ScheduleD", wholeEuro(result.scheduleD))}
  </Trade>${rentalSection}
  <ChargesDeductions>
    ${xmlTag("PensionContributions", wholeEuro(input.pensionContributions))}
    ${xmlTag("MedicalExpenses", wholeEuro(input.medicalExpenses))}
    ${xmlTag("CharitableDonations", wholeEuro(input.charitableDonations))}
    ${xmlTag("PensionRelief", wholeEuro(result.pensionRelief))}
    ${xmlTag("TotalDeductions", wholeEuro(result.totalDeductions))}
  </ChargesDeductions>${cgtSection}
  <SummaryCalculation>
    ${xmlTag("TotalGrossIncome", wholeEuro(result.totalGrossIncome))}
    ${xmlTag("AssessableIncome", wholeEuro(result.assessableIncome))}
    <IncomeTax>
${bandLines}
      ${xmlTag("GrossIncomeTax", wholeEuro(result.grossIncomeTax))}
    </IncomeTax>
    <TaxCredits>
${creditLines}
      ${xmlTag("TotalCredits", wholeEuro(result.totalCredits))}
    </TaxCredits>
    ${xmlTag("NetIncomeTax", wholeEuro(result.netIncomeTax))}
    <USC>
      ${xmlTag("Exempt", result.uscExempt ? "Y" : "N")}
${uscLines}
      ${xmlTag("TotalUSC", wholeEuro(result.totalUSC))}
    </USC>
    <PRSI>
      ${xmlTag("Class", "S")}
      ${xmlTag("AssessableIncome", wholeEuro(result.prsiAssessable))}
      ${xmlTag("PRSIPayable", wholeEuro(result.prsiPayable))}
    </PRSI>
    ${xmlTag("TotalLiability", wholeEuro(result.totalLiability))}
    ${xmlTag("PreliminaryTaxPaid", wholeEuro(result.preliminaryTaxPaid))}
    ${xmlTag("BalanceDue", wholeEuro(result.balanceDue))}
  </SummaryCalculation>
</Form11>`;
}

/** Generate Form 11 XML and trigger download */
export function generateForm11Xml(data: Form11ReportData): void {
  const xml = buildForm11Xml(data);
  const name = data.input.directorName.replace(/\s+/g, "_");
  saveXml(xml, `Form11_${name}_${data.meta.taxYear}.xml`);
}
