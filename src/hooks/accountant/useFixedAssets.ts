import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type AssetCategory =
  | "land_and_buildings"
  | "plant_and_machinery"
  | "fixtures_and_fittings"
  | "motor_vehicles"
  | "computer_equipment"
  | "office_equipment";

export type DepreciationMethod = "straight_line" | "reducing_balance";

export interface FixedAsset {
  id: string;
  user_id: string;
  created_by: string;
  asset_name: string;
  asset_category: AssetCategory;
  purchase_date: string;
  purchase_cost: number;
  residual_value: number;
  useful_life_years: number;
  depreciation_method: DepreciationMethod;
  depreciation_rate: number | null;
  disposal_date: string | null;
  disposal_proceeds: number | null;
  notes: string | null;
  created_at: string;
}

export interface DepreciationSchedule {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

export interface CapitalAllowanceSummary {
  category: AssetCategory;
  totalCost: number;
  annualAllowance: number;
  ratePercent: number;
  periodYears: number;
}

// ────────────────────────────────────────────
// Depreciation helpers
// ────────────────────────────────────────────

/**
 * Calculate depreciation for a given asset at a given tax year end.
 * Pro-rata for part-year ownership (months owned / 12).
 */
export function calculateDepreciation(
  asset: FixedAsset,
  taxYear: number,
): DepreciationSchedule {
  const cost = Number(asset.purchase_cost);
  const residual = Number(asset.residual_value);
  const usefulLife = asset.useful_life_years;
  const purchaseDate = new Date(asset.purchase_date);
  const yearEnd = new Date(taxYear, 11, 31); // 31 Dec of tax year
  const yearStart = new Date(taxYear, 0, 1); // 1 Jan of tax year

  // If asset was purchased after this tax year, no depreciation
  if (purchaseDate > yearEnd) {
    return { annualDepreciation: 0, accumulatedDepreciation: 0, netBookValue: cost };
  }

  // If asset was disposed before this tax year started, full depreciation up to disposal
  const disposalDate = asset.disposal_date ? new Date(asset.disposal_date) : null;

  if (asset.depreciation_method === "straight_line") {
    const annualFull = (cost - residual) / usefulLife;

    let accumulated = 0;
    let currentYearDep = 0;

    for (let y = purchaseDate.getFullYear(); y <= taxYear; y++) {
      const yStart = new Date(y, 0, 1);
      const yEnd = new Date(y, 11, 31);

      // If disposed before this year, stop
      if (disposalDate && disposalDate < yStart) break;

      // Months owned in this year
      const effectiveStart = purchaseDate > yStart ? purchaseDate : yStart;
      const effectiveEnd = disposalDate && disposalDate < yEnd ? disposalDate : yEnd;

      if (effectiveStart > effectiveEnd) continue;

      const monthsOwned = monthsBetween(effectiveStart, effectiveEnd);
      const yearDep = Math.min(annualFull * (monthsOwned / 12), cost - residual - accumulated);

      if (yearDep <= 0) break;

      accumulated += yearDep;
      if (y === taxYear) currentYearDep = yearDep;
    }

    accumulated = Math.min(accumulated, cost - residual);

    return {
      annualDepreciation: Math.round(currentYearDep * 100) / 100,
      accumulatedDepreciation: Math.round(accumulated * 100) / 100,
      netBookValue: Math.round((cost - accumulated) * 100) / 100,
    };
  }

  // Reducing balance
  const rate = (Number(asset.depreciation_rate) || 25) / 100;
  let nbv = cost;
  let currentYearDep = 0;

  for (let y = purchaseDate.getFullYear(); y <= taxYear; y++) {
    const yStart = new Date(y, 0, 1);
    const yEnd = new Date(y, 11, 31);

    if (disposalDate && disposalDate < yStart) break;

    const effectiveStart = purchaseDate > yStart ? purchaseDate : yStart;
    const effectiveEnd = disposalDate && disposalDate < yEnd ? disposalDate : yEnd;

    if (effectiveStart > effectiveEnd) continue;

    const monthsOwned = monthsBetween(effectiveStart, effectiveEnd);
    const yearDep = nbv * rate * (monthsOwned / 12);

    nbv -= yearDep;
    if (nbv < residual) {
      const adjusted = yearDep - (residual - nbv);
      nbv = residual;
      if (y === taxYear) currentYearDep = Math.max(0, adjusted);
    } else {
      if (y === taxYear) currentYearDep = yearDep;
    }
  }

  const accumulated = cost - nbv;

  return {
    annualDepreciation: Math.round(currentYearDep * 100) / 100,
    accumulatedDepreciation: Math.round(accumulated * 100) / 100,
    netBookValue: Math.round(nbv * 100) / 100,
  };
}

/**
 * Irish capital allowances:
 * - Plant & machinery, motor vehicles, computer/office equipment, fixtures: 12.5% p.a. over 8 years
 * - Land & buildings (industrial): 4% p.a. over 25 years
 */
export function calculateCapitalAllowance(
  asset: FixedAsset,
  taxYear: number,
): { annualAllowance: number; totalClaimed: number; remainingAllowance: number } {
  const cost = Number(asset.purchase_cost);
  const purchaseYear = new Date(asset.purchase_date).getFullYear();
  const yearsOwned = taxYear - purchaseYear + 1;

  let ratePercent: number;
  let periodYears: number;

  if (asset.asset_category === "land_and_buildings") {
    ratePercent = 4;
    periodYears = 25;
  } else {
    ratePercent = 12.5;
    periodYears = 8;
  }

  const annualAllowance = cost * (ratePercent / 100);

  if (yearsOwned <= 0) {
    return { annualAllowance: 0, totalClaimed: 0, remainingAllowance: cost };
  }

  const yearsClaimed = Math.min(yearsOwned, periodYears);
  const totalClaimed = annualAllowance * yearsClaimed;
  const remainingAllowance = Math.max(0, cost - totalClaimed);

  return {
    annualAllowance: Math.round(annualAllowance * 100) / 100,
    totalClaimed: Math.round(totalClaimed * 100) / 100,
    remainingAllowance: Math.round(remainingAllowance * 100) / 100,
  };
}

function monthsBetween(start: Date, end: Date): number {
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1; // inclusive of both start and end months
  return Math.max(1, Math.min(12, months));
}

// ────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────

export function useFixedAssets(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["fixed-assets", clientUserId],
    queryFn: async (): Promise<FixedAsset[]> => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("purchase_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as FixedAsset[];
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────

export function useCreateFixedAsset() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      asset_name: string;
      asset_category: AssetCategory;
      purchase_date: string;
      purchase_cost: number;
      residual_value: number;
      useful_life_years: number;
      depreciation_method: DepreciationMethod;
      depreciation_rate?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .insert({
          ...input,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["fixed-assets", variables.user_id] });
      toast.success("Asset added successfully");
    },
    onError: () => {
      toast.error("Failed to add asset");
    },
  });
}

export function useUpdateFixedAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      updates: Partial<Pick<FixedAsset, "asset_name" | "residual_value" | "useful_life_years" | "depreciation_method" | "depreciation_rate" | "notes">>;
    }) => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .update(input.updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["fixed-assets", variables.user_id] });
      toast.success("Asset updated");
    },
    onError: () => {
      toast.error("Failed to update asset");
    },
  });
}

export function useDisposeFixedAsset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      disposal_date: string;
      disposal_proceeds: number;
    }) => {
      const { data, error } = await supabase
        .from("fixed_assets")
        .update({
          disposal_date: input.disposal_date,
          disposal_proceeds: input.disposal_proceeds,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["fixed-assets", variables.user_id] });
      toast.success("Asset disposed");
    },
    onError: () => {
      toast.error("Failed to dispose asset");
    },
  });
}
