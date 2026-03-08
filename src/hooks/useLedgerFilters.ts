import { useState, useMemo, useCallback } from "react";

export interface LedgerFilters {
  searchText: string;
  dateRange: { from?: Date; to?: Date };
  amountRange: { min?: number; max?: number };
  categoryFilter: string | null;
  sortField: "date" | "amount" | "description";
  sortDirection: "asc" | "desc";
}

const DEFAULT_FILTERS: LedgerFilters = {
  searchText: "",
  dateRange: {},
  amountRange: {},
  categoryFilter: null,
  sortField: "date",
  sortDirection: "desc",
};

export function useLedgerFilters(transactions: Record<string, unknown>[]) {
  const [filters, setFilters] = useState<LedgerFilters>(DEFAULT_FILTERS);

  const setSearchText = useCallback((v: string) => setFilters((f) => ({ ...f, searchText: v })), []);
  const setDateRange = useCallback((v: { from?: Date; to?: Date }) => setFilters((f) => ({ ...f, dateRange: v })), []);
  const setAmountRange = useCallback((v: { min?: number; max?: number }) => setFilters((f) => ({ ...f, amountRange: v })), []);
  const setCategoryFilter = useCallback((v: string | null) => setFilters((f) => ({ ...f, categoryFilter: v })), []);
  const setSortField = useCallback((v: "date" | "amount" | "description") => setFilters((f) => ({ ...f, sortField: v })), []);
  const setSortDirection = useCallback((v: "asc" | "desc") => setFilters((f) => ({ ...f, sortDirection: v })), []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchText) count++;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.amountRange.min !== undefined || filters.amountRange.max !== undefined) count++;
    if (filters.categoryFilter) count++;
    if (filters.sortField !== "date" || filters.sortDirection !== "desc") count++;
    return count;
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Text search
    if (filters.searchText) {
      const query = filters.searchText.toLowerCase();
      result = result.filter((t) => {
        const desc = String(t.description || "").toLowerCase();
        const catName = String((t.category as Record<string, unknown>)?.name || "").toLowerCase();
        return desc.includes(query) || catName.includes(query);
      });
    }

    // Date range
    if (filters.dateRange.from) {
      const fromStr = filters.dateRange.from.toISOString().split("T")[0];
      result = result.filter((t) => String(t.transaction_date || "") >= fromStr);
    }
    if (filters.dateRange.to) {
      const toStr = filters.dateRange.to.toISOString().split("T")[0];
      result = result.filter((t) => String(t.transaction_date || "") <= toStr);
    }

    // Amount range
    if (filters.amountRange.min !== undefined) {
      result = result.filter((t) => Math.abs(Number(t.amount) || 0) >= filters.amountRange.min!);
    }
    if (filters.amountRange.max !== undefined) {
      result = result.filter((t) => Math.abs(Number(t.amount) || 0) <= filters.amountRange.max!);
    }

    // Category filter
    if (filters.categoryFilter) {
      result = result.filter((t) => (t.category_id as string) === filters.categoryFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      switch (filters.sortField) {
        case "date":
          cmp = String(a.transaction_date || "").localeCompare(String(b.transaction_date || ""));
          break;
        case "amount":
          cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
          break;
        case "description":
          cmp = String(a.description || "").localeCompare(String(b.description || ""));
          break;
      }
      return filters.sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [transactions, filters]);

  return {
    filters,
    filteredTransactions,
    setSearchText,
    setDateRange,
    setAmountRange,
    setCategoryFilter,
    setSortField,
    setSortDirection,
    clearFilters,
    activeFilterCount,
  };
}
