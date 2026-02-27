/**
 * Client Form 11 data hook for accountant view.
 * Mirrors useForm11Data logic but uses clientUserId-parameterized queries.
 * Read-only — no mutations. No localStorage questionnaire (uses DB data only).
 */
import { useMemo, useCallback } from "react";
import { useClientTransactions, useClientAccounts, useClientDirectorOnboarding } from "./useClientData";
import { scanForReliefs } from "@/lib/reliefScanner";
import { calculateForm11, calculateVehicleBIK, type Form11Input, type Form11Result } from "@/lib/form11Calculator";
import { calculateAnnualCommuteMileage } from "@/lib/revenueRates";

export function useClientForm11Data(clientUserId: string | null | undefined, directorNumber: number) {
  // Check if personal accounts exist
  const { data: personalAccounts } = useClientAccounts(clientUserId, "directors_personal_tax");
  const hasPersonalAccounts = (personalAccounts?.length ?? 0) > 0;

  // Determine tax year (Irish tax year = calendar year)
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  // When personal accounts exist, filter business transactions to business accounts
  const businessAccountType = hasPersonalAccounts ? "limited_company" : undefined;

  // Fetch transactions for the tax year
  const { data: incomeTransactions, isLoading: incomeLoading } = useClientTransactions(clientUserId, {
    type: "income", startDate, endDate, accountType: businessAccountType,
  });

  const { data: expenseTransactions, isLoading: expenseLoading } = useClientTransactions(clientUserId, {
    type: "expense", startDate, endDate, accountType: businessAccountType,
  });

  // Relief scan — scan personal account expenses (or all if no personal accounts)
  const reliefAccountType = hasPersonalAccounts ? "directors_personal_tax" : undefined;
  const { data: reliefExpenses, isLoading: reliefsLoading } = useClientTransactions(clientUserId, {
    type: "expense", startDate, endDate, accountType: reliefAccountType,
  });

  const reliefs = useMemo(() => {
    if (!reliefExpenses) return null;
    return scanForReliefs(reliefExpenses);
  }, [reliefExpenses]);

  // Fetch director onboarding data
  const { data: directorRows, isLoading: directorLoading } = useClientDirectorOnboarding(clientUserId);

  const getDirector = useCallback(
    (num: number) => {
      const row = directorRows?.find((d: Record<string, unknown>) => (d as { director_number: number }).director_number === num);
      if (!row) return null;
      return (row as Record<string, unknown>).onboarding_data as Record<string, unknown> | null;
    },
    [directorRows],
  );

  const isLoading = incomeLoading || expenseLoading || reliefsLoading || directorLoading;

  const { input, result } = useMemo(() => {
    if (!clientUserId) return { input: null, result: null };

    // ── 1. Director Onboarding Data ──────────────────
    const onboarding = getDirector(directorNumber);
    if (!onboarding) return { input: null, result: null };

    // ── 2. Transaction Totals ────────────────────────
    const businessIncome = (incomeTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const businessExpenses = (expenseTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    // ── Map marital status ───────────────────────────
    const maritalStatus = normalizeMaritalStatus(onboarding.marital_status as string | null | undefined);
    const assessmentBasis = normalizeAssessmentBasis(onboarding.assessment_basis as string | null | undefined);

    // ── Salary / Dividends (from onboarding only — no localStorage questionnaire for accountant) ──
    const salary = (onboarding.annual_salary as number) ?? 0;
    const dividends = (onboarding.estimated_dividends as number) ?? 0;

    // ── BIK ──────────────────────────────────────────
    let bik = 0;
    if (
      onboarding.has_bik &&
      (onboarding.bik_types as string[] | undefined)?.includes("company_vehicle") &&
      onboarding.company_vehicle_value
    ) {
      bik = calculateVehicleBIK(
        onboarding.company_vehicle_value as number,
        (onboarding.company_vehicle_business_km as number) ?? 24_000,
      );
    }

    // ── Mileage Allowance ────────────────────────────
    let mileageAllowance = 0;
    if (onboarding.commute_method === "personal_vehicle" && (onboarding.commute_distance_km as number) > 0) {
      mileageAllowance = calculateAnnualCommuteMileage(onboarding.commute_distance_km as number);
    }

    // ── Reliefs (auto-detected from transactions) ────
    const pensionContributions = reliefs?.pension.total || 0;
    const medicalExpenses = reliefs?.medical.total || 0;
    const rentPaid = reliefs?.rent.total || 0;
    const charitableDonations = reliefs?.charitable.total || 0;

    // ── Build input ──────────────────────────────────
    const form11Input: Form11Input = {
      directorName: (onboarding.director_name as string) ?? `Director ${directorNumber}`,
      ppsNumber: (onboarding.pps_number as string) ?? "",
      dateOfBirth: (onboarding.date_of_birth as string) ?? "",
      maritalStatus,
      assessmentBasis,

      salary,
      dividends,
      bik,

      businessIncome,
      businessExpenses,
      capitalAllowances: 0,

      rentalIncome: 0,
      rentalExpenses: 0,
      foreignIncome: 0,
      otherIncome: 0,

      capitalGains: 0,
      capitalLosses: 0,

      pensionContributions,
      medicalExpenses,
      rentPaid,
      charitableDonations,
      remoteWorkingCosts: 0,

      mileageAllowance,

      spouseIncome: 0,

      claimHomeCarer: (onboarding.home_carer_credit as boolean) ?? false,
      claimSingleParent: false,
      hasPAYEIncome: ((onboarding.income_sources as string[]) ?? []).includes("paye_employment"),

      preliminaryTaxPaid: 0,
    };

    const form11Result = calculateForm11(form11Input, taxYear);

    return { input: form11Input, result: form11Result };
  }, [clientUserId, directorNumber, incomeTransactions, expenseTransactions, reliefs, getDirector, taxYear]);

  return { input, result, isLoading, taxYear };
}

// ── Normalizers ──────────────────────────────────────────────

function normalizeMaritalStatus(raw: string | null | undefined): Form11Input["maritalStatus"] {
  const valid = ["single", "married", "civil_partner", "widowed", "separated"];
  return valid.includes(raw ?? "") ? (raw as Form11Input["maritalStatus"]) : "single";
}

function normalizeAssessmentBasis(raw: string | null | undefined): Form11Input["assessmentBasis"] {
  const valid = ["single", "joint", "separate"];
  return valid.includes(raw ?? "") ? (raw as Form11Input["assessmentBasis"]) : "single";
}
