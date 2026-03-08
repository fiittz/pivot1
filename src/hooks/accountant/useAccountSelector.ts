import { useState, useMemo, useCallback } from "react";
import { useClientAccounts } from "@/hooks/accountant/useClientData";

export interface AccountSelection {
  accountId: string;
  accountName: string;
  accountType: string;
  isCash: boolean;
  taxScope: string;
  selected: boolean;
}

export function useAccountSelector(clientUserId: string | null | undefined, defaultScope?: "ct1" | "form11") {
  const { data: accounts } = useClientAccounts(clientUserId);

  // Track which accounts are selected (default: all non-excluded accounts matching scope)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const selections = useMemo((): AccountSelection[] => {
    if (!accounts) return [];
    return accounts.map((acc: Record<string, unknown>) => {
      const taxScope = (acc.tax_scope as string) ?? "ct1";
      const isCash = (acc.is_cash as boolean) ?? false;

      // Default selection based on scope
      let defaultSelected = true;
      if (taxScope === "excluded") defaultSelected = false;
      if (defaultScope === "ct1" && taxScope === "form11") defaultSelected = false;
      if (defaultScope === "form11" && taxScope === "ct1") defaultSelected = false;

      return {
        accountId: acc.id as string,
        accountName: acc.name as string,
        accountType: acc.account_type as string,
        isCash,
        taxScope,
        selected: overrides[acc.id as string] ?? defaultSelected,
      };
    });
  }, [accounts, overrides, defaultScope]);

  const selectedAccountIds = useMemo(
    () => selections.filter(s => s.selected).map(s => s.accountId),
    [selections]
  );

  const toggleAccount = useCallback((accountId: string) => {
    setOverrides(prev => ({
      ...prev,
      [accountId]: !(prev[accountId] ?? selections.find(s => s.accountId === accountId)?.selected ?? true),
    }));
  }, [selections]);

  const selectAll = useCallback(() => {
    const newOverrides: Record<string, boolean> = {};
    selections.forEach(s => { newOverrides[s.accountId] = true; });
    setOverrides(newOverrides);
  }, [selections]);

  const deselectAll = useCallback(() => {
    const newOverrides: Record<string, boolean> = {};
    selections.forEach(s => { newOverrides[s.accountId] = false; });
    setOverrides(newOverrides);
  }, [selections]);

  return {
    selections,
    selectedAccountIds,
    toggleAccount,
    selectAll,
    deselectAll,
    hasAccounts: (accounts?.length ?? 0) > 0,
  };
}
