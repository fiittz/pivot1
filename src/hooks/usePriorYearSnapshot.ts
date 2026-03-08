import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  loadPriorYearSnapshot,
  loadYearEndSnapshot,
  saveYearEndSnapshot,
  snapshotToOpeningBalances,
  type YearEndSnapshot,
} from "@/services/yearEndSnapshotService";

/**
 * Load prior year closing snapshot → this year's opening balances.
 */
export function usePriorYearOpeningBalances(userId: string | undefined, currentTaxYear: number) {
  return useQuery({
    queryKey: ["prior-year-snapshot", userId, currentTaxYear],
    queryFn: async () => {
      if (!userId) return null;
      const snapshot = await loadPriorYearSnapshot(userId, currentTaxYear);
      if (!snapshot) return null;
      return {
        snapshot,
        openingBalances: snapshotToOpeningBalances(snapshot),
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Load a specific year's snapshot.
 */
export function useYearEndSnapshot(userId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: ["year-end-snapshot", userId, taxYear],
    queryFn: () => (userId ? loadYearEndSnapshot(userId, taxYear) : null),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Save/import a year-end snapshot.
 */
export function useSaveYearEndSnapshot() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (snapshot: Omit<YearEndSnapshot, "id">) => saveYearEndSnapshot(snapshot),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["year-end-snapshot", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["prior-year-snapshot", variables.user_id] });
      toast.success(`Prior year balances saved for ${variables.tax_year}`);
    },
    onError: () => {
      toast.error("Failed to save prior year balances");
    },
  });
}
