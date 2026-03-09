import type { Form11ReportData } from "../types";
import { xmlDeclaration, xmlEl, xmlTag, wholeEuro, fmtRevDate, saveXml } from "../xmlHelpers";

const MARITAL_STATUS_CODES: Record<string, number> = {
  single: 1,
  married: 2,
  civil_partner: 3,
  widowed: 4,
  separated: 5,
};

/**
 * Extended options for Form 11 XML generation.
 * Maps questionnaire and onboarding data to Revenue fields.
 */
export interface Form11XmlOptions {
  // ── From director onboarding ──
  dateOfBirth?: string;           // ISO date
  homeAddress?: string;
  homeCounty?: string;
  employerName?: string;          // actual employer name (not hardcoded)
  employmentStartDate?: string;   // ISO date

  // ── From finalization questionnaire ──
  medicalExpenses?: number;
  rentPaid?: number;              // rent relief (s.473A)
  remoteWorkingDays?: number;
  remoteWorkingCosts?: number;
  charitableDonationsAmount?: number; // override input.charitableDonations
  pensionContributionsAmount?: number;

  // ── Reliefs from onboarding ──
  claimHomeCarer?: boolean;
  claimSingleParent?: boolean;
  hasDependentChildren?: boolean;
  dependentChildrenCount?: number;
  flatRateExpenses?: boolean;
  flatRateExpenseAmount?: number;

  // ── Spouse details (joint assessment) ──
  spouseHasIncome?: boolean;
  spousePpsNumber?: string;
  spouseFirstName?: string;
  spouseSurname?: string;
  spouseIncomeType?: string[];
  spouseIncomeAmount?: number;
  spouseEmployerName?: string;

  // ── Foreign income detail ──
  foreignIncomeCountry?: string;
  foreignTaxPaid?: number;
  hasForeignBankAccounts?: boolean;
  hasForeignProperty?: boolean;
  hasCryptoHoldings?: boolean;

  // ── Capital gains detail ──
  propertyDisposals?: boolean;
  shareDisposals?: boolean;
  cryptoDisposals?: boolean;
  disposalDetails?: Array<{
    description: string;
    dateAcquired: string;
    dateSold: string;
    costPrice: number;
    salePrice: number;
  }>;

  // ── BIK detail from onboarding ──
  bikTypes?: string[];
  companyVehicleValue?: number;
  companyVehicleBusinessKm?: number;
  healthInsuranceBik?: number;

  // ── Preliminary tax ──
  preliminaryTaxDate?: string;    // ISO date

  // ── Rental detail (instead of approximate split) ──
  rentalRepairsExpenses?: number;
  rentalInterestExpenses?: number;
  rentalOtherExpenses?: number;
  rentalInsuranceExpenses?: number;
  rentalManagementFees?: number;

  // ── Multiple trades ──
  additionalTrades?: Array<{
    tradeName: string;
    profit: number;
    capitalAllowances: number;
  }>;

  // ── Multiple employments ──
  additionalEmployments?: Array<{
    employerName: string;
    income: number;
    taxDeducted: number;
  }>;
}

/**
 * Build Form 11 XML string from report data.
 * Revenue Form11 v26 XSD — attribute-based elements.
 *
 * Maps onboarding, finalization questionnaire, and calculated data
 * to Revenue-required fields.
 */
export function buildForm11Xml(data: Form11ReportData, options?: Form11XmlOptions): string {
  const { input, result } = data;
  const opts = options ?? {};
  const taxYear = data.meta.taxYear;
  const periodStart = `01/01/${taxYear}`;
  const periodEnd = `31/12/${taxYear}`;
  const maritalCode = MARITAL_STATUS_CODES[input.maritalStatus] ?? 1;

  // Split director name into firstname/surname
  const nameParts = input.directorName.split(" ");
  const firstName = nameParts[0] ?? "";
  const surname = nameParts.slice(1).join(" ") || firstName;

  // Total PAYE emoluments: salary + dividends + BIK + mileage
  const emoluments = wholeEuro(result.scheduleE);

  // ── Personal Section ──
  let personalSection = `
  <Personal>
    ${xmlEl("Details", {
      surname,
      firstname: firstName,
      ppsnself: input.ppsNumber,
      dateofbirthself: opts.dateOfBirth ? fmtRevDate(opts.dateOfBirth) : null,
    })}
    ${xmlEl("Marital", { status: maritalCode })}`;

  // Address
  if (opts.homeAddress) {
    personalSection += `
    ${xmlEl("Address", {
      addressline1: opts.homeAddress,
      county: opts.homeCounty || null,
    })}`;
  }

  // Spouse details for joint/separate assessment
  if ((input.assessmentBasis === "joint" || input.assessmentBasis === "separate") && opts.spouseFirstName) {
    personalSection += `
    ${xmlEl("SpouseDetails", {
      spousefirstname: opts.spouseFirstName,
      spousesurname: opts.spouseSurname || null,
      spouseppsnumber: opts.spousePpsNumber || null,
    })}`;
  }

  personalSection += `
  </Personal>`;

  // ── Trade Section (Schedule D) ──
  let tradeSection = "";
  if (result.scheduleD > 0 || input.businessIncome > 0) {
    tradeSection = `
  <Trade>
    ${xmlEl("TradeInfo", {
      tradeno: 1,
      tradedescription: data.meta.companyName || "Trade 1",
      profityear: wholeEuro(result.scheduleD),
      adjustednetprofit: wholeEuro(result.scheduleD),
    })}
    ${xmlEl("TradeCapital", {
      machinery: wholeEuro(input.capitalAllowances) || null,
    })}
  </Trade>`;

    // Additional trades
    if (opts.additionalTrades && opts.additionalTrades.length > 0) {
      for (let i = 0; i < opts.additionalTrades.length; i++) {
        const trade = opts.additionalTrades[i];
        tradeSection += `
  <Trade>
    ${xmlEl("TradeInfo", {
      tradeno: i + 2,
      tradedescription: trade.tradeName,
      profityear: wholeEuro(trade.profit),
      adjustednetprofit: wholeEuro(trade.profit),
    })}
    ${trade.capitalAllowances > 0 ? xmlEl("TradeCapital", { machinery: wholeEuro(trade.capitalAllowances) }) : ""}
  </Trade>`;
      }
    }
  }

  // ── Rental Section ──
  let rentalSection = "";
  if (result.rentalProfit > 0 || input.rentalIncome > 0) {
    // Use actual categorized expenses if available, otherwise estimate
    let repairsExpenses: number;
    let interestExpenses: number;
    let otherExpenses: number;

    if (opts.rentalRepairsExpenses !== undefined || opts.rentalInterestExpenses !== undefined) {
      repairsExpenses = wholeEuro(opts.rentalRepairsExpenses ?? 0);
      interestExpenses = wholeEuro(opts.rentalInterestExpenses ?? 0);
      const insurance = wholeEuro(opts.rentalInsuranceExpenses ?? 0);
      const management = wholeEuro(opts.rentalManagementFees ?? 0);
      otherExpenses = wholeEuro(opts.rentalOtherExpenses ?? 0) + insurance + management;
    } else {
      const totalRentalExp = wholeEuro(input.rentalExpenses);
      repairsExpenses = wholeEuro(totalRentalExp * 0.34);
      interestExpenses = wholeEuro(totalRentalExp * 0.33);
      otherExpenses = totalRentalExp - repairsExpenses - interestExpenses;
    }

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

  // ── PAYE Section ──
  const employerName = opts.employerName || data.meta.companyName || "Employer";
  let payeSection = `
  <Paye>
    ${xmlEl("Employments", {
      employmentno: 1,
      employername: employerName,
      indicatorselforspouse: "true",
      amtit: emoluments,
    })}`;

  // Additional employments
  if (opts.additionalEmployments && opts.additionalEmployments.length > 0) {
    for (let i = 0; i < opts.additionalEmployments.length; i++) {
      const emp = opts.additionalEmployments[i];
      payeSection += `
    ${xmlEl("Employments", {
      employmentno: i + 2,
      employername: emp.employerName,
      indicatorselforspouse: "true",
      amtit: wholeEuro(emp.income),
      taxdeducted: wholeEuro(emp.taxDeducted),
    })}`;
    }
  }

  // Spouse employment (joint assessment)
  if (opts.spouseHasIncome && opts.spouseIncomeAmount && opts.spouseIncomeAmount > 0) {
    if (opts.spouseIncomeType?.includes("paye")) {
      payeSection += `
    ${xmlEl("Employments", {
      employername: opts.spouseEmployerName || "Spouse Employer",
      indicatorselforspouse: "false",
      amtit: wholeEuro(opts.spouseIncomeAmount),
    })}`;
    }
  }

  // Benefits in Kind
  let bikSection = "";
  if (input.bik > 0) {
    const bikAttrs: Record<string, string | number | null> = {
      otheramtself: wholeEuro(input.bik),
    };
    if (opts.companyVehicleValue) {
      bikAttrs.vehicleomv = wholeEuro(opts.companyVehicleValue);
      bikAttrs.vehiclebusinesskm = opts.companyVehicleBusinessKm ?? null;
    }
    if (opts.healthInsuranceBik) {
      bikAttrs.healthinsurance = wholeEuro(opts.healthInsuranceBik);
    }
    bikSection = `
    <Pensions>
      ${xmlEl("BenefitInKind", bikAttrs)}
    </Pensions>`;
  }

  payeSection += bikSection;
  payeSection += `
  </Paye>`;

  // ── Foreign Income Section ──
  let foreignSection = "";
  if (input.foreignIncome > 0 || result.foreignIncome > 0) {
    foreignSection = `
  <ForeignIncome>
    ${xmlEl("ForeignIncome", {
      country: opts.foreignIncomeCountry || "Not specified",
      grossincome: wholeEuro(input.foreignIncome),
      foreigntaxpaid: wholeEuro(opts.foreignTaxPaid ?? 0),
    })}
  </ForeignIncome>`;
  }

  // ── Foreign Assets Declaration ──
  let foreignAssetsSection = "";
  if (opts.hasForeignBankAccounts || opts.hasForeignProperty || opts.hasCryptoHoldings) {
    foreignAssetsSection = `
  <ForeignAssets>
    ${xmlEl("ForeignAssetsDeclaration", {
      foreignbankaccounts: opts.hasForeignBankAccounts ? "true" : "false",
      foreignproperty: opts.hasForeignProperty ? "true" : "false",
      cryptoassets: opts.hasCryptoHoldings ? "true" : "false",
    })}
  </ForeignAssets>`;
  }

  // ── Allowances & Reliefs ──
  let allowancesSection = `
  <Allowances>`;

  // Pension relief
  if (input.pensionContributions > 0 || (opts.pensionContributionsAmount ?? 0) > 0) {
    const pensionAmount = opts.pensionContributionsAmount ?? input.pensionContributions;
    allowancesSection += `
    <RetirementAnnuityRelief>
      <RetirementReliefDtls>
        ${xmlEl("RelevantEarnings", { relevantearning: wholeEuro(result.scheduleD + result.scheduleE) })}
        ${xmlEl("PensionContributions", { amountpaid: wholeEuro(pensionAmount) })}
      </RetirementReliefDtls>
    </RetirementAnnuityRelief>`;
  }

  // Medical expenses (s.469)
  if ((opts.medicalExpenses ?? 0) > 0) {
    const medRelief = wholeEuro((opts.medicalExpenses ?? 0) * 0.20); // 20% relief
    allowancesSection += `
    <MedicalExpenses>
      ${xmlEl("MedicalExpenses", {
        totalexpenses: wholeEuro(opts.medicalExpenses ?? 0),
        reliefamount: medRelief,
        reliefrate: "20",
      })}
    </MedicalExpenses>`;
  }

  // Rent paid relief (if applicable for pre-2017 tenancies or qualifying cases)
  if ((opts.rentPaid ?? input.rentPaid ?? 0) > 0) {
    allowancesSection += `
    <RentRelief>
      ${xmlEl("RentRelief", {
        rentpaid: wholeEuro(opts.rentPaid ?? input.rentPaid ?? 0),
      })}
    </RentRelief>`;
  }

  // Remote working relief (s.114A)
  if ((opts.remoteWorkingDays ?? 0) > 0 || (opts.remoteWorkingCosts ?? input.remoteWorkingCosts ?? 0) > 0) {
    allowancesSection += `
    <RemoteWorking>
      ${xmlEl("RemoteWorking", {
        daysworkedremotely: opts.remoteWorkingDays ?? null,
        costsclaimed: wholeEuro(opts.remoteWorkingCosts ?? input.remoteWorkingCosts ?? 0),
      })}
    </RemoteWorking>`;
  }

  // Flat rate expenses
  if (opts.flatRateExpenses && (opts.flatRateExpenseAmount ?? 0) > 0) {
    allowancesSection += `
    <FlatRateExpenses>
      ${xmlEl("FlatRateExpenses", {
        amount: wholeEuro(opts.flatRateExpenseAmount ?? 0),
      })}
    </FlatRateExpenses>`;
  }

  // Mileage allowance
  if (input.mileageAllowance > 0) {
    allowancesSection += `
    <MileageAllowance>
      ${xmlEl("MileageAllowance", {
        amount: wholeEuro(input.mileageAllowance),
      })}
    </MileageAllowance>`;
  }

  allowancesSection += `
  </Allowances>`;

  // ── Charges & Deductions (Charitable Donations s.848A) ──
  let chargesSection = "";
  const donations = opts.charitableDonationsAmount ?? input.charitableDonations ?? 0;
  if (donations > 0) {
    chargesSection = `
  <ChargesDeductions>
    ${xmlEl("TaxRelief", { payment: wholeEuro(donations) })}
  </ChargesDeductions>`;
  }

  // ── Capital Gains Section ──
  let cgtSection = "";
  if (result.cgtApplicable) {
    const chargeableGain = wholeEuro(result.cgtGains - result.cgtLosses - result.cgtExemption);

    // Detailed disposals if available
    let disposalLines = "";
    if (opts.disposalDetails && opts.disposalDetails.length > 0) {
      disposalLines = opts.disposalDetails.map((d) => {
        const gain = d.salePrice - d.costPrice;
        return `    ${xmlEl("DisposalDetail", {
          description: d.description,
          dateacquired: fmtRevDate(d.dateAcquired),
          datesold: fmtRevDate(d.dateSold),
          costprice: wholeEuro(d.costPrice),
          saleprice: wholeEuro(d.salePrice),
          gainorloss: wholeEuro(gain),
        })}`;
      }).join("\n");
    }

    cgtSection = `
  <CapitalGains>
    ${xmlEl("AcquisitionDetails", {
      gainself: wholeEuro(result.cgtGains),
      lossself: wholeEuro(result.cgtLosses),
      annualexemption: wholeEuro(result.cgtExemption),
      chargeablegainself: chargeableGain > 0 ? chargeableGain : 0,
      chargegainahighrtself: chargeableGain > 0 ? chargeableGain : 0,
      cgtrate: "33",
      cgtpayable: wholeEuro(result.cgtPayable),
    })}
${disposalLines}
  </CapitalGains>`;
  }

  // ── Tax Credits ──
  let creditsSection = "";
  if (result.credits && result.credits.length > 0) {
    const creditLines = result.credits.map((c) =>
      `    ${xmlEl("Credit", { description: c.label, amount: wholeEuro(c.amount) })}`
    ).join("\n");
    creditsSection = `
  <TaxCredits>
${creditLines}
    ${xmlEl("TotalCredits", { amount: wholeEuro(result.totalCredits) })}
  </TaxCredits>`;
  }

  // ── Self Assessment ──
  const selfAssessment = `
  <SelfAssessmentIT>
    ${xmlEl("SelfAssessmentIT", {
      selfamtincomeorprofit: wholeEuro(result.assessableIncome),
      selfgrossincometax: wholeEuro(result.grossIncomeTax),
      selfincometaxcharge: wholeEuro(result.netIncomeTax),
      selftotalcredits: wholeEuro(result.totalCredits),
      selfusccharge: wholeEuro(result.totalUSC),
      selfprsicharge: wholeEuro(result.prsiPayable),
      selfcgtcharge: result.cgtApplicable ? wholeEuro(result.cgtPayable) : null,
      selftotaltaxcharge: wholeEuro(result.totalLiability),
      selfamttaxpayable: wholeEuro(result.totalLiability),
      selfamttaxpaiddirect: wholeEuro(result.preliminaryTaxPaid),
      selfbalancetaxpayable: wholeEuro(result.balanceDue),
      declareselfassessment: "true",
    })}
  </SelfAssessmentIT>`;

  // ── Summary Calculation ──
  const incomeLines: string[] = [];
  if (result.scheduleD > 0) {
    incomeLines.push(`      ${xmlEl("Trade", { description: data.meta.companyName || "Trade 1", amount: wholeEuro(result.scheduleD) })}`);
  }
  if (emoluments > 0) {
    incomeLines.push(`      ${xmlEl("Emoluments", { amount: emoluments })}`);
  }
  if (result.rentalProfit > 0) {
    incomeLines.push(`      ${xmlEl("RentalIncome", { amount: wholeEuro(result.rentalProfit) })}`);
  }
  if (result.foreignIncome > 0) {
    incomeLines.push(`      ${xmlEl("ForeignIncome", { amount: wholeEuro(result.foreignIncome) })}`);
  }
  if (result.otherIncome > 0) {
    incomeLines.push(`      ${xmlEl("OtherIncome", { amount: wholeEuro(result.otherIncome) })}`);
  }
  if (input.assessmentBasis === "joint" && result.spouseIncome > 0) {
    incomeLines.push(`      ${xmlEl("SpouseIncome", { amount: wholeEuro(result.spouseIncome) })}`);
  }

  const summaryCalc = `
  <SummaryCalculation>
    <Income>
${incomeLines.join("\n")}
    </Income>
    ${xmlEl("TotalGrossIncome", { amount: wholeEuro(result.totalGrossIncome) })}
    ${xmlEl("TotalDeductions", { amount: wholeEuro(result.totalDeductions ?? 0) })}
    <TaxCalculation>
      ${xmlEl("IncomeTax", { amount: wholeEuro(result.netIncomeTax) })}
      ${xmlEl("USC", { amount: wholeEuro(result.totalUSC) })}
      ${xmlEl("PRSI", { amount: wholeEuro(result.prsiPayable) })}
      ${result.cgtApplicable ? xmlEl("CGT", { amount: wholeEuro(result.cgtPayable) }) : ""}
      ${xmlEl("TotalLiability", { amount: wholeEuro(result.totalLiability) })}
      ${xmlEl("PreliminaryTaxPaid", { amount: wholeEuro(result.preliminaryTaxPaid) })}
      ${xmlEl("BalanceDue", { amount: wholeEuro(result.balanceDue) })}
    </TaxCalculation>
  </SummaryCalculation>`;

  return `${xmlDeclaration()}
<Form11 xmlns="http://www.ros.ie/schemas/form11/v26/" periodstart="${periodStart}" periodend="${periodEnd}" currency="E" formversion="26" language="EN">${personalSection}${tradeSection}${rentalSection}${payeSection}${foreignSection}${foreignAssetsSection}${allowancesSection}${chargesSection}${cgtSection}${creditsSection}${selfAssessment}${summaryCalc}
</Form11>`;
}

/** Generate Form 11 XML and trigger download */
export function generateForm11Xml(data: Form11ReportData, options?: Form11XmlOptions): void {
  const xml = buildForm11Xml(data, options);
  const name = data.input.directorName.replace(/\s+/g, "_");
  saveXml(xml, `Form11_${name}_${data.meta.taxYear}.xml`);
}
