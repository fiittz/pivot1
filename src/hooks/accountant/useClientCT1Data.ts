/**
 * Client CT1 data hook for accountant view.
 * Mirrors useCT1Data logic but uses clientUserId-parameterized queries.
 * Read-only — no mutations.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClientTransactions, useClientInvoices, useClientOnboardingSettings, useClientDirectorOnboarding } from "./useClientData";
import { isCTDeductible } from "@/lib/vatDeductibility";
import { calculateVehicleDepreciation } from "@/lib/vehicleDepreciation";
import type { CT1Data } from "@/hooks/useCT1Data";

const CONSTRUCTION_TRADE_TYPES = [
  "construction", "forestry", "meat_processing",
  "carpentry_joinery", "electrical", "plumbing_heating",
];

function classifyPaymentType(description: string): string {
  const d = (description || "").toLowerCase();
  if (d.includes("salary") || d.includes("wages")) return "Wages";
  if (d.includes("sepa")) return "SEPA Transfer";
  if (d.includes("direct debit") || d.includes(" dd ") || d.startsWith("dd ")) return "Direct Debit";
  if (d.includes("pos") || d.includes("card")) return "Card Payment";
  if (d.includes("standing order") || d.includes("s/o")) return "Standing Order";
  if (d.includes("cheque") || d.includes("chq")) return "Cheque";
  return "Other";
}

export function useClientCT1Data(clientUserId: string | null | undefined): CT1Data {
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: incomeTransactions, isLoading: incomeLoading } = useClientTransactions(clientUserId, {
    type: "income", startDate, endDate, accountType: "limited_company",
  });
  const { data: expenseTransactions, isLoading: expenseLoading } = useClientTransactions(clientUserId, {
    type: "expense", startDate, endDate, accountType: "limited_company",
  });
  const { data: onboarding, isLoading: onboardingLoading } = useClientOnboardingSettings(clientUserId);
  const { data: directorRows, isLoading: directorLoading } = useClientDirectorOnboarding(clientUserId);
  const { data: invoices, isLoading: invoicesLoading } = useClientInvoices(clientUserId);

  // RCT payment notifications — eRCT deductions at source (matches client-side useCT1Data)
  const { data: rctNotifications, isLoading: rctLoading } = useQuery({
    queryKey: ["rct-notifications-for-ct1", clientUserId, taxYear],
    queryFn: async () => {
      if (!clientUserId) return [];
      const { data } = await supabase
        .from("rct_payment_notifications")
        .select("rct_amount, status, created_at, rct_contracts!inner(user_id)")
        .eq("rct_contracts.user_id", clientUserId)
        .gte("created_at", startDate)
        .lte("created_at", `${endDate}T23:59:59`)
        .neq("status", "rejected");
      return (data ?? []) as { rct_amount: number; status: string; created_at: string }[];
    },
    enabled: !!clientUserId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch CT1 questionnaire data from Supabase (client-entered values)
  const { data: questionnaireData, isLoading: questionnaireLoading } = useQuery({
    queryKey: ["questionnaire", "ct1", String(taxYear), clientUserId],
    queryFn: async () => {
      if (!clientUserId) return null;
      const { data, error } = await supabase
        .from("questionnaire_responses")
        .select("response_data")
        .eq("user_id", clientUserId)
        .eq("questionnaire_type", "ct1")
        .eq("period_key", String(taxYear))
        .maybeSingle();
      if (error) {
        console.error("Error fetching CT1 questionnaire:", error);
        return null;
      }
      return (data?.response_data as Record<string, unknown>) ?? null;
    },
    enabled: !!clientUserId,
    staleTime: 30_000,
  });

  const isLoading = incomeLoading || expenseLoading || onboardingLoading || directorLoading || invoicesLoading || rctLoading || questionnaireLoading;

  return useMemo(() => {
    const NON_TAXABLE_CATEGORIES = ["Tax Refund"];
    const incomeByCategory = new Map<string, number>();
    for (const t of incomeTransactions ?? []) {
      const catName = (t.category as { id: string; name: string } | null)?.name ?? "Uncategorised";
      if (NON_TAXABLE_CATEGORIES.includes(catName)) continue;
      const desc = (t.description ?? "").toLowerCase();
      if (catName === "Uncategorised" && (desc.includes("revenue") || desc.includes("collector general") || desc.includes("tax refund"))) continue;
      incomeByCategory.set(catName, (incomeByCategory.get(catName) ?? 0) + Math.abs(Number(t.amount) || 0));
    }
    const detectedIncome = Array.from(incomeByCategory.entries()).map(([category, amount]) => ({ category, amount }));

    const isDLA = (catName: string | null) => {
      if (!catName) return false;
      const lower = catName.toLowerCase();
      return lower.includes("drawing") || lower.includes("director's loan") || lower.includes("directors loan");
    };

    let allowable = 0;
    let disallowed = 0;
    let totalDLADebits = 0;
    let totalMovedFromPersonal = 0;
    const disallowedByCategoryMap = new Map<string, number>();
    const expenseByCategoryMap = new Map<string, number>();

    for (const t of expenseTransactions ?? []) {
      const amt = Math.abs(Number(t.amount) || 0);
      const catName = (t.category as { id: string; name: string } | null)?.name ?? null;

      // Track business expenses paid from director's personal pocket
      const txNotes = (t as Record<string, unknown>).notes as string | null;
      if (txNotes?.includes("[MOVED_FROM_PERSONAL]")) {
        totalMovedFromPersonal += amt;
      }

      if (isDLA(catName)) { totalDLADebits += amt; continue; }

      const result = isCTDeductible(t.description ?? "", catName);
      if (result.isDeductible) { allowable += amt; } else {
        disallowed += amt;
        const dCat = catName ?? "Uncategorised";
        disallowedByCategoryMap.set(dCat, (disallowedByCategoryMap.get(dCat) ?? 0) + amt);
      }
      expenseByCategoryMap.set(catName ?? "Uncategorised", (expenseByCategoryMap.get(catName ?? "Uncategorised") ?? 0) + amt);
    }

    const disallowedByCategory = Array.from(disallowedByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
    const expenseByCategory = Array.from(expenseByCategoryMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const expenseSummary = { allowable, disallowed };

    const paymentsByType = new Map<string, number>();
    for (const t of [...(incomeTransactions ?? []), ...(expenseTransactions ?? [])]) {
      const paymentType = classifyPaymentType(t.description ?? "");
      paymentsByType.set(paymentType, (paymentsByType.get(paymentType) ?? 0) + Math.abs(Number(t.amount) || 0));
    }
    const detectedPayments = Array.from(paymentsByType.entries()).map(([type, amount]) => ({ type, amount }));

    const totalIncome = (incomeTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const totalExpenses = (expenseTransactions ?? []).reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
    const closingBalance = totalIncome - totalExpenses;

    const flaggedCapitalItems: CT1Data["flaggedCapitalItems"] = [];
    const capitalKeywords = ["equipment", "tools", "vehicle", "fixed asset", "machinery", "plant"];
    // Revenue expense categories that should NEVER be flagged as capital
    const revenueExclude = [
      "salary", "wage", "payroll", "director",
      "subcontract", "labour", "contractor",
      "insurance", "liability",
      "accounting", "legal", "professional fee",
      "rent", "lease", "utility", "utilities",
      "phone", "broadband", "internet", "subscription",
      "fuel", "diesel", "petrol", "motor expense",
      "travel", "mileage", "accommodation",
      "advertising", "marketing",
      "office supplies", "stationery", "postage",
      "bank charge", "interest", "finance charge",
      "training", "course",
    ];
    for (const t of expenseTransactions ?? []) {
      const amt = Math.abs(Number(t.amount) || 0);
      const catName = (t.category as { id: string; name: string } | null)?.name?.toLowerCase() ?? "";
      const desc = (t.description ?? "").toLowerCase();
      const isCapitalCategory = capitalKeywords.some((kw) => catName.includes(kw));
      const isRevenueExpense = revenueExclude.some((kw) => catName.includes(kw) || desc.includes(kw));
      if (amt >= 1000 && !isRevenueExpense) {
        flaggedCapitalItems.push({ description: t.description ?? "Unknown", date: t.transaction_date ?? "", amount: amt });
      }
    }

    const isConstructionTrade = CONSTRUCTION_TRADE_TYPES.includes(onboarding?.business_type ?? "");

    let vehicleAsset: CT1Data["vehicleAsset"] = null;
    const director1Data = (directorRows?.[0] as Record<string, unknown>)?.onboarding_data as Record<string, unknown> | undefined;
    if (director1Data?.vehicle_owned_by_director && (director1Data?.vehicle_purchase_cost as number) > 0) {
      const depreciation = calculateVehicleDepreciation({
        description: (director1Data.vehicle_description as string) || "Motor Vehicle",
        reg: (director1Data.vehicle_reg as string) || "",
        purchaseCost: Number(director1Data.vehicle_purchase_cost) || 0,
        dateAcquired: (director1Data.vehicle_date_acquired as string) || `${taxYear}-01-01`,
        businessUsePct: Number(director1Data.vehicle_business_use_pct) || 100,
      }, taxYear);
      vehicleAsset = {
        description: (director1Data.vehicle_description as string) || "Motor Vehicle",
        reg: (director1Data.vehicle_reg as string) || "",
        depreciation,
      };
    }

    // RCT prepayment — Source 1: Invoice notes (legacy) + Source 2: eRCT notifications
    let rctPrepayment = 0;
    for (const inv of invoices ?? []) {
      const invRecord = inv as Record<string, unknown>;
      const invDate = (invRecord.invoice_date ?? "") as string;
      if (invDate < startDate || invDate > endDate) continue;
      try {
        const notes = invRecord.notes ? JSON.parse(invRecord.notes as string) : null;
        if (notes?.rct_enabled && notes?.rct_amount > 0) rctPrepayment += Number(notes.rct_amount) || 0;
      } catch { /* not JSON */ }
    }
    // Source 2: eRCT payment notifications (Revenue eRCT system)
    for (const notif of rctNotifications ?? []) {
      rctPrepayment += Number(notif.rct_amount) || 0;
    }
    rctPrepayment = Math.round(rctPrepayment * 100) / 100;

    // Business expenses paid from director's personal pocket — company owes director
    const movedFromPersonalCredits = Math.round(totalMovedFromPersonal * 100) / 100;

    // ── Merge questionnaire data from Supabase ───────────────
    const q = questionnaireData ?? {};
    const num = (key: string) => Number(q[key]) || 0;

    const capitalAllowancesPlant = num("capitalAllowancesPlant");
    const capitalAllowancesMotorVehicles = num("capitalAllowancesMotorVehicles");
    const addBackDepreciation = num("addBackDepreciation");
    const addBackEntertainment = num("addBackEntertainment");
    const addBackOther = num("addBackOther");
    const closeCompanySurcharge = num("closeCompanySurcharge");
    const lossesForward = num("lossesForward");
    const preliminaryCTPaid = num("preliminaryCTPaid");
    // Client saves: prepaymentsAmount, accrualsAmount, accruedIncomeAmount, deferredIncomeAmount
    const prepayments = num("prepaymentsAmount");
    const accruals = num("accrualsAmount");
    const accruedIncome = num("accruedIncomeAmount");
    const deferredIncome = num("deferredIncomeAmount");
    const fixedAssets = num("fixedAssets");
    const currentAssets = num("currentAssets");
    const liabilities = num("liabilities");
    const shareCapital = num("shareCapital");

    return {
      detectedIncome,
      expenseByCategory,
      expenseSummary,
      disallowedByCategory,
      detectedPayments,
      closingBalance,
      vatPosition: undefined, // Simplified for accountant view — full VAT analysis on VAT tab
      flaggedCapitalItems,
      vehicleAsset,
      rctPrepayment,
      travelAllowance: 0, // Requires trip matching — deferred to full review
      directorsLoanTravel: 0,
      movedFromPersonalCredits,
      directorsLoanDebits: Math.round(totalDLADebits * 100) / 100,
      netDirectorsLoan: Math.round((movedFromPersonalCredits - totalDLADebits) * 100) / 100,
      isConstructionTrade,
      isCloseCompany: true,
      isLoading,
      reEvaluationApplied: false,
      reEvaluationWarnings: [],
      // Questionnaire-sourced values
      capitalAllowancesPlant,
      capitalAllowancesMotorVehicles,
      addBackDepreciation,
      addBackEntertainment,
      addBackOther,
      closeCompanySurcharge,
      lossesForward,
      preliminaryCTPaid,
      prepayments,
      accruals,
      accruedIncome,
      deferredIncome,
      fixedAssets,
      currentAssets,
      liabilities,
      shareCapital,
    };
  }, [incomeTransactions, expenseTransactions, onboarding, directorRows, invoices, rctNotifications, isLoading, startDate, endDate, taxYear, questionnaireData]);
}
