import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

interface UseTableSortOptions<T> {
  defaultField?: keyof T & string;
  defaultDir?: SortDirection;
}

interface UseTableSortReturn<T> {
  sortField: (keyof T & string) | null;
  sortDir: SortDirection;
  onSort: (field: keyof T & string) => void;
  sortData: (data: T[]) => T[];
}

export function useTableSort<T>(
  options: UseTableSortOptions<T> = {},
): UseTableSortReturn<T> {
  const [sortField, setSortField] = useState<(keyof T & string) | null>(
    options.defaultField ?? null,
  );
  const [sortDir, setSortDir] = useState<SortDirection>(
    options.defaultDir ?? "asc",
  );

  const onSort = useCallback(
    (field: keyof T & string) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  const sortData = useCallback(
    (data: T[]): T[] => {
      if (!sortField) return data;

      return [...data].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let cmp: number;
        if (typeof aVal === "number" && typeof bVal === "number") {
          cmp = aVal - bVal;
        } else if (typeof aVal === "string" && typeof bVal === "string") {
          cmp = aVal.localeCompare(bVal);
        } else {
          cmp = String(aVal).localeCompare(String(bVal));
        }

        return sortDir === "asc" ? cmp : -cmp;
      });
    },
    [sortField, sortDir],
  );

  return { sortField, sortDir, onSort, sortData };
}
