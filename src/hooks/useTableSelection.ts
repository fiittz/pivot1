import { useState, useCallback, useMemo } from "react";

interface UseTableSelectionReturn {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (allIds: string[]) => void;
  clear: () => void;
  isAllSelected: (allIds: string[]) => boolean;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

export function useTableSelection(): UseTableSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isAllSelected = useCallback(
    (allIds: string[]) => allIds.length > 0 && allIds.every((id) => selectedIds.has(id)),
    [selectedIds],
  );

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  const selectedCount = selectedIds.size;

  return { selectedIds, toggle, toggleAll, clear, isAllSelected, isSelected, selectedCount };
}
