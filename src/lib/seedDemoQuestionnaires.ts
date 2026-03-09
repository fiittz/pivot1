/**
 * Seeds CT1 and Form 11 questionnaire data into both Supabase and localStorage
 * for the Oakmont demo account (jamie@oakmont.ie).
 *
 * Supabase storage allows accountants to see the same data.
 * localStorage is kept for backward compatibility with existing reads.
 */
import { supabase } from "@/integrations/supabase/client";

export function seedOakmontQuestionnaires(userId: string, taxYear = "2025") {
  // ── CT1 Questionnaire ──
  const ct1Key = `ct1_questionnaire_${userId}_${taxYear}`;
  const ct1 = {
    automationNoChanges: true,
    incomeComplete: true,
    expensesCorrect: true,
    vatStatus: "invoice_basis",
    vatStatusCorrect: true,
    rctApplicable: true,
    rctDeductionsCorrect: true,
    rctTotalDeducted: 7250,
    rctNotes: "RCT deducted by McCarthy Builders on phases 1-3",
    capitalTransactionsCorrect: true,
    hasClosingStock: false,
    closingStockValue: 0,
    hasTradeDebtors: true,
    tradeDebtorsTotal: 4500,
    hasBadDebts: false,
    hasTradeCreditorsOutstanding: true,
    tradeCreditorsTotal: 1850,
    fixedAssetsLandBuildings: 0,
    fixedAssetsPlantMachinery: 4100,
    fixedAssetsMotorVehicles: 28500,
    fixedAssetsFixturesFittings: 800,
    currentAssetsStock: 0,
    currentAssetsDebtors: 4500,
    currentAssetsCash: 250,
    currentAssetsBankBalance: 34562,
    liabilitiesCreditors: 1850,
    liabilitiesTaxation: 3200,
    liabilitiesBankLoans: 0,
    liabilitiesDirectorsLoans: 0,
    capitalAllowancesPlant: 513,
    capitalAllowancesMotorVehicles: 3031,
    addBackDepreciation: 4200,
    addBackEntertainment: 230,
    addBackOther: 574.50,
    addBackNotes: "Depreciation (accounting), client entertainment, uncategorised personal items",
    isCloseCompany: true,
    distributedProfitsSufficiently: true,
    closeCompanySurcharge: 0,
    lossesForward: 0,
    preliminaryCTPaid: 3800,
    preliminaryCTAmount: 3800,
    preliminaryCTDate: "2025-11-21",
    claimStartupExemption: false,
    hasDividendsPaid: true,
    dividendsPaidAmount: 5000,
    dwtDeducted: 1250,
    hasAssetDisposals: false,
    finalDeclaration: true,
    prepaymentsAmount: 400,
    accrualsAmount: 650,
    openingPrepayments: 0,
    openingAccruals: 0,
    accruedIncomeAmount: 0,
    deferredIncomeAmount: 0,
  };

  localStorage.setItem(ct1Key, JSON.stringify(ct1));

  // ── Form 11 Questionnaire (Director 1) ──
  const form11Key = `form11_questionnaire_${userId}_1`;
  const form11 = {
    noChanges: true,
    incomeComplete: true,
    salaryCorrect: true,
    salaryAmount: 48000,
    dividendsReceived: true,
    dividendsAmount: 5000,
    bikApplicable: false,
    bikCorrect: true,
    bikEstimatedValue: 0,
    reliefsCorrect: true,
    medicalExpensesAmount: 1200,
    pensionContributionsAmount: 4800,
    rentReliefAmount: 0,
    charitableDonationsAmount: 500,
    remoteWorkingDays: 0,
    spouseHasIncome: true,
    spouseIncomeType: ["paye"],
    spouseIncomeAmount: 38000,
    spouseEmployerName: "St. James's Hospital",
    preliminaryTaxPaid: "yes",
    preliminaryTaxAmount: "8500",
    preliminaryTaxDate: "2025-11-15",
    edgeCases: {
      capitalGains: false,
      foreignIncome: false,
      chargeableBenefits: false,
      none: true,
    },
    rentalIncomeDetails: false,
    rentalIncomeAmount: 0,
    rentalExpensesAmount: 0,
    finalDeclaration: true,
  };

  localStorage.setItem(form11Key, JSON.stringify(form11));

  // ── Sync to Supabase (fire-and-forget) ──
  supabase
    .from("questionnaire_responses")
    .upsert(
      [
        {
          user_id: userId,
          questionnaire_type: "ct1",
          period_key: taxYear,
          response_data: ct1,
          updated_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          questionnaire_type: "form11",
          period_key: "1",
          response_data: form11,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "user_id,questionnaire_type,period_key" },
    )
    .then(({ error }) => {
      if (error) console.error("[Oakmont Demo] Supabase questionnaire sync failed:", error);
    });

  // eslint-disable-next-line no-console
  console.log(`[Oakmont Demo] Seeded CT1 + Form 11 questionnaires for ${taxYear}`);
}
