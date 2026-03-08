import { supabase } from "@/integrations/supabase/client";

export interface YearEndSnapshot {
  id?: string;
  user_id: string;
  tax_year: number;
  source: "system" | "accountant_import" | "client_import";
  imported_by?: string;

  // Fixed Assets
  fixed_assets_land_buildings: number;
  fixed_assets_plant_machinery: number;
  fixed_assets_motor_vehicles: number;
  fixed_assets_fixtures_fittings: number;

  // Current Assets
  stock: number;
  work_in_progress: number;
  debtors: number;
  prepayments: number;
  accrued_income: number;
  cash: number;
  bank_balance: number;
  rct_prepayment: number;

  // Current Liabilities
  creditors: number;
  accrued_expenses: number;
  deferred_income: number;
  taxation: number;
  bank_overdraft: number;
  directors_loan_current: number;
  vat_liability: number;

  // Long-term Liabilities
  bank_loans: number;
  directors_loans: number;

  // Capital & Reserves
  share_capital: number;
  retained_profits: number;

  // P&L summary
  turnover?: number;
  cost_of_sales?: number;
  gross_profit?: number;
  total_expenses?: number;
  net_profit?: number;
  losses_forward: number;
  capital_allowances_claimed: number;

  notes?: string;
}

/**
 * Save a year-end snapshot (upsert — one per user per year).
 * Called automatically when filing is finalised, or manually by accountant import.
 */
export async function saveYearEndSnapshot(
  snapshot: Omit<YearEndSnapshot, "id">,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("year_end_snapshots")
    .upsert(snapshot, { onConflict: "user_id,tax_year" });

  if (error) {
    console.error("[YearEndSnapshot] Save error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Load the prior year's closing snapshot to use as this year's opening balances.
 * Returns null if no prior year data exists.
 */
export async function loadPriorYearSnapshot(
  userId: string,
  currentTaxYear: number,
): Promise<YearEndSnapshot | null> {
  const priorYear = currentTaxYear - 1;

  const { data, error } = await supabase
    .from("year_end_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", priorYear)
    .maybeSingle();

  if (error) {
    console.error("[YearEndSnapshot] Load error:", error);
    return null;
  }

  return data as YearEndSnapshot | null;
}

/**
 * Load a specific year's snapshot.
 */
export async function loadYearEndSnapshot(
  userId: string,
  taxYear: number,
): Promise<YearEndSnapshot | null> {
  const { data, error } = await supabase
    .from("year_end_snapshots")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .maybeSingle();

  if (error) {
    console.error("[YearEndSnapshot] Load error:", error);
    return null;
  }

  return data as YearEndSnapshot | null;
}

/**
 * Convert a prior year snapshot into questionnaire opening balances.
 * This maps closing BS figures → next year's opening balances.
 */
export function snapshotToOpeningBalances(snapshot: YearEndSnapshot): Record<string, number> {
  return {
    // Fixed assets carry forward at NBV
    fixedAssetsLandBuildings: snapshot.fixed_assets_land_buildings,
    fixedAssetsPlantMachinery: snapshot.fixed_assets_plant_machinery,
    fixedAssetsMotorVehicles: snapshot.fixed_assets_motor_vehicles,
    fixedAssetsFixturesFittings: snapshot.fixed_assets_fixtures_fittings,

    // Current assets
    currentAssetsStock: snapshot.stock,
    currentAssetsDebtors: snapshot.debtors,
    currentAssetsCash: snapshot.cash,
    currentAssetsBankBalance: snapshot.bank_balance,

    // Accrual opening balances (last year's closing = this year's opening)
    openingPrepayments: snapshot.prepayments,
    openingAccruals: snapshot.accrued_expenses,
    openingAccruedIncome: snapshot.accrued_income,
    openingDeferredIncome: snapshot.deferred_income,

    // Liabilities
    liabilitiesCreditors: snapshot.creditors,
    liabilitiesBankLoans: snapshot.bank_loans,
    liabilitiesDirectorsLoans: snapshot.directors_loans,

    // Losses
    lossesForward: snapshot.losses_forward,

    // Capital
    shareCapital: snapshot.share_capital,
  };
}

/**
 * Build a snapshot from the CT1 questionnaire data + computed values.
 * Called when a filing is finalised to auto-save the closing position.
 */
export function questionnaireToSnapshot(
  userId: string,
  taxYear: number,
  questionnaire: Record<string, unknown>,
  computed: {
    totalIncome: number;
    totalExpenses: number;
    tradingProfit: number;
    ctLiability: number;
    capitalAllowancesTotal: number;
    motorVehicleNBV: number;
    rctPrepayment: number;
    directorsLoanTravel: number;
  },
): Omit<YearEndSnapshot, "id"> {
  const q = questionnaire;
  const n = (key: string) => (q[key] as number) ?? 0;

  return {
    user_id: userId,
    tax_year: taxYear,
    source: "system",

    fixed_assets_land_buildings: n("fixedAssetsLandBuildings"),
    fixed_assets_plant_machinery: n("fixedAssetsPlantMachinery"),
    fixed_assets_motor_vehicles: computed.motorVehicleNBV || n("fixedAssetsMotorVehicles"),
    fixed_assets_fixtures_fittings: n("fixedAssetsFixturesFittings"),

    stock: n("currentAssetsStock"),
    work_in_progress: n("wipValue"),
    debtors: n("currentAssetsDebtors") || n("tradeDebtorsTotal"),
    prepayments: n("prepaymentsAmount"),
    accrued_income: n("accruedIncomeAmount"),
    cash: n("currentAssetsCash"),
    bank_balance: n("currentAssetsBankBalance"),
    rct_prepayment: computed.rctPrepayment,

    creditors: n("liabilitiesCreditors") || n("tradeCreditorsTotal"),
    accrued_expenses: n("accrualsAmount"),
    deferred_income: n("deferredIncomeAmount"),
    taxation: computed.ctLiability,
    bank_overdraft: 0,
    directors_loan_current: computed.directorsLoanTravel,
    vat_liability: 0,

    bank_loans: n("liabilitiesBankLoans"),
    directors_loans: n("liabilitiesDirectorsLoans") || n("directorsLoanBalance"),

    share_capital: n("shareCapital") || 100,
    retained_profits: 0, // computed as balancing figure

    turnover: computed.totalIncome,
    cost_of_sales: undefined,
    gross_profit: undefined,
    total_expenses: computed.totalExpenses,
    net_profit: computed.tradingProfit,
    losses_forward: Math.max(0, -(computed.tradingProfit)), // if loss, carry forward
    capital_allowances_claimed: computed.capitalAllowancesTotal,
  };
}
