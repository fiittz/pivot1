import React, { useRef, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronUp, ChevronDown, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/hooks/useTableSort";

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorFn: (row: T) => React.ReactNode;
  /** Plain-text accessor for CSV export. Falls back to rendering accessorFn as string. */
  exportFn?: (row: T) => string;
  sortField?: string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyMessage?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (allIds: string[]) => void;
  isAllSelected?: boolean;
  sortField?: string | null;
  sortDir?: SortDirection;
  onSort?: (field: string) => void;
  skeletonRows?: number;
  groupBy?: (row: T) => string;
  renderGroupHeader?: (groupKey: string, groupRows: T[]) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  emptyIcon,
  emptyMessage = "No data found",
  emptyDescription,
  onRowClick,
  selectable,
  selectedIds,
  onToggle,
  onToggleAll,
  isAllSelected,
  sortField,
  sortDir,
  onSort,
  skeletonRows = 8,
  groupBy,
  renderGroupHeader,
}: DataTableProps<T>) {
  const allIds = data.map(getRowId);
  const totalCols = columns.length + (selectable ? 1 : 0);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  // Keyboard navigation: ↑↓ to move, Enter to open, Space to select
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
      const target = e.target as HTMLElement;
      const row = target.closest("tr");
      if (!row) return;

      const rows = Array.from(tbodyRef.current?.querySelectorAll("tr[data-row-id]") ?? []);
      const idx = rows.indexOf(row);
      if (idx === -1) return;

      if (e.key === "ArrowDown" && idx < rows.length - 1) {
        e.preventDefault();
        (rows[idx + 1] as HTMLElement).focus();
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        (rows[idx - 1] as HTMLElement).focus();
      } else if (e.key === "Enter" && onRowClick) {
        e.preventDefault();
        const rowId = row.getAttribute("data-row-id");
        const rowData = data.find((r) => getRowId(r) === rowId);
        if (rowData) onRowClick(rowData);
      } else if (e.key === " " && selectable && onToggle) {
        e.preventDefault();
        const rowId = row.getAttribute("data-row-id");
        if (rowId) onToggle(rowId);
      }
    },
    [data, getRowId, onRowClick, selectable, onToggle],
  );

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b sticky top-0 z-10 bg-card">
            <tr className="border-b transition-colors bg-muted/30 hover:bg-muted/30">
              {selectable && (
                <th className="h-9 w-10 py-2 px-3 text-left align-middle font-medium text-muted-foreground">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={() => onToggleAll?.(allIds)}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    "h-9 py-2 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    col.width,
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.sortField && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={col.sortField && onSort ? () => onSort(col.sortField!) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortField && sortField === col.sortField && (
                      sortDir === "asc" ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            ref={tbodyRef}
            className="[&_tr:last-child]:border-0"
            onKeyDown={handleKeyDown}
          >
            {isLoading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b transition-colors">
                  {selectable && (
                    <td className="py-2 px-3 align-middle">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.id} className="py-2 px-3 align-middle">
                      <Skeleton className="h-4 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr className="border-b transition-colors">
                <td colSpan={totalCols} className="py-16 text-center align-middle">
                  <div className="flex flex-col items-center gap-2">
                    {emptyIcon || <Inbox className="w-10 h-10 text-muted-foreground/40" />}
                    <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                    {emptyDescription && (
                      <p className="text-xs text-muted-foreground">{emptyDescription}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => {
                const rowId = getRowId(row);
                const isSelected = selectedIds?.has(rowId);
                const showGroupHeader =
                  groupBy &&
                  renderGroupHeader &&
                  (rowIdx === 0 || groupBy(row) !== groupBy(data[rowIdx - 1]));
                return (
                  <React.Fragment key={rowId}>
                    {showGroupHeader && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={totalCols} className="py-2 px-3">
                          {renderGroupHeader(
                            groupBy!(row),
                            data.filter((r) => groupBy!(r) === groupBy!(row)),
                          )}
                        </td>
                      </tr>
                    )}
                    <tr
                      data-row-id={rowId}
                      tabIndex={0}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50 group outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset",
                        onRowClick && "cursor-pointer",
                        isSelected && "bg-muted/50",
                      )}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <td className="py-2 px-3 w-10 align-middle">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggle?.(rowId)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={cn(
                            "py-2 px-3 align-middle",
                            col.width,
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                          )}
                        >
                          {col.accessorFn(row)}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
