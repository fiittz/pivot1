import type { Form11ReportData } from "../types";
import { xmlDeclaration, xmlEl, wholeEuro, saveXml } from "../xmlHelpers";

const MARITAL_STATUS_CODES: Record<string, number> = {
  single: 1,
  married: 2,
  civil_partner: 3,
  widowed: 4,
  separated: 5,
};

/**
 * Build Form 11 XML string from report data.
 * Revenue Form11 v26 XSD — attribute-based elements.
 */
export function buildForm11Xml(data: Form11ReportData): string {
  const { input, result } = data;
  const taxYear = data.meta.taxYear;
  const periodStart = `01/01/${taxYear}`;
  const periodEnd = `31/12/${taxYear}`;
  const maritalCode = MARITAL_STATUS_CODES[input.maritalStatus] ?? 1;

  // Split director name into firstname/surname
  const nameParts = input.directorName.split(" ");
  const firstName = nameParts[0] ?? "";
  const surname = nameParts.slice(1).join(" ");

  // Total PAYE emoluments: salary + dividends + BIK + mileage
  const emoluments = wholeEuro(result.scheduleE);

  // Conditional: Rental section
  let rentalSection = "";
  if (result.rentalProfit > 0 || input.rentalIncome > 0) {
    const rentalExpenses = wholeEuro(input.rentalExpenses);
    // Split expenses roughly (simplified — actual split would need more detail)
    const repairsExpenses = wholeEuro(rentalExpenses * 0.34);
    const interestExpenses = wholeEuro(rentalExpenses * 0.33);
    const otherExpenses = rentalExpenses - repairsExpenses - interestExpenses;
    rentalSection = `
  <Rental>
    ${xmlEl("Residential", {
      rentself: wholeEuro(input.rentalIncome),
      repairsexpensesself: repairsExpenses,
      interestexpensesself: interestExpenses,
      otherexpensesself: otherExpenses,
      netrentself: wholeEuro(result.rentalProfit),
    })}
  </Rental>`;
  }

  // Conditional: CGT section
  let cgtSection = "";
  if (result.cgtApplicable) {
    const chargeableGain = wholeEuro(result.cgtGains - result.cgtLosses - result.cgtExemption);
    cgtSection = `
  <CapitalGains>
    ${xmlEl("AcquisitionDetails", {
      gainself: wholeEuro(result.cgtGains),
      chargeablegainself: chargeableGain > 0 ? chargeableGain : 0,
      chargegainahighrtself: chargeableGain > 0 ? chargeableGain : 0,
    })}
  </CapitalGains>`;
  }

  // Charitable donations
  let chargesSection = "<ChargesDeductions/>";
  if (input.charitableDonations > 0) {
    chargesSection = `<ChargesDeductions>
    ${xmlEl("TaxRelief", { payment: wholeEuro(input.charitableDonations) })}
  </ChargesDeductions>`;
  }

  // Income breakdown for SummaryCalculation
  const incomeLines: string[] = [];
  if (result.scheduleD > 0) {
    incomeLines.push(`      ${xmlEl("Trade", { description: "Trade 1", amount: wholeEuro(result.scheduleD) })}`);
  }
  if (emoluments > 0) {
    incomeLines.push(`      ${xmlEl("Emoluments", { amount: emoluments })}`);
  }
  if (result.rentalProfit > 0) {
    incomeLines.push(`      ${xmlEl("RentalIncome", { amount: wholeEuro(result.rentalProfit) })}`);
  }

  return `${xmlDeclaration()}
<Form11 xmlns="http://www.ros.ie/schemas/form11/v26/" periodstart="${periodStart}" periodend="${periodEnd}" currency="E" formversion="26" language="EN">
  <Personal>
    ${xmlEl("Details", { surname, firstname: firstName, ppsnself: input.ppsNumber })}
    ${xmlEl("Marital", { status: maritalCode })}
  </Personal>
  <Trade>
    ${xmlEl("TradeInfo", { tradeno: 1, profityear: wholeEuro(result.scheduleD), adjustednetprofit: wholeEuro(result.scheduleD) })}
    ${xmlEl("TradeCapital", { machinery: wholeEuro(input.capitalAllowances) })}
  </Trade>${rentalSection}
  <Paye>
    ${xmlEl("Employments", { employername: "Employer", indicatorselforspouse: "true", amtit: emoluments })}
    <Pensions>
      ${xmlEl("BenefitInKind", { otheramtself: wholeEuro(input.bik) })}
    </Pensions>
  </Paye>
  <Allowances>
    <RetirementAnnuityRelief>
      <RetirementReliefDtls>
        ${xmlEl("RelevantEarnings", { relevantearning: wholeEuro(result.scheduleD) })}
      </RetirementReliefDtls>
    </RetirementAnnuityRelief>
  </Allowances>
  ${chargesSection}${cgtSection}
  <SelfAssessmentIT>
    ${xmlEl("SelfAssessmentIT", {
      selfamtincomeorprofit: wholeEuro(result.assessableIncome),
      selfincometaxcharge: wholeEuro(result.netIncomeTax),
      selfusccharge: wholeEuro(result.totalUSC),
      selfprsicharge: wholeEuro(result.prsiPayable),
      selftotaltaxcharge: wholeEuro(result.totalLiability),
      selfamttaxpayable: wholeEuro(result.totalLiability),
      selfamttaxpaiddirect: wholeEuro(result.preliminaryTaxPaid),
      selfbalancetaxpayable: wholeEuro(result.balanceDue),
      declareselfassessment: "true",
    })}
  </SelfAssessmentIT>
  <SummaryCalculation>
    <Income>
${incomeLines.join("\n")}
    </Income>
  </SummaryCalculation>
</Form11>`;
}

/** Generate Form 11 XML and trigger download */
export function generateForm11Xml(data: Form11ReportData): void {
  const xml = buildForm11Xml(data);
  const name = data.input.directorName.replace(/\s+/g, "_");
  saveXml(xml, `Form11_${name}_${data.meta.taxYear}.xml`);
}
