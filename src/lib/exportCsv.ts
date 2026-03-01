import type { ColumnDef } from "@/components/accountant/table";

/**
 * Export table data to CSV and trigger a download.
 */
export function exportToCSV<T>(
  columns: ColumnDef<T>[],
  data: T[],
  filename = "export.csv",
) {
  // Filter to columns that have headers (skip action/icon columns)
  const exportCols = columns.filter((col) => col.header);

  const header = exportCols.map((col) => `"${col.header}"`).join(",");

  const rows = data.map((row) =>
    exportCols
      .map((col) => {
        if (col.exportFn) return `"${col.exportFn(row).replace(/"/g, '""')}"`;
        // Fallback: try to extract text content from the accessor result
        const val = col.accessorFn(row);
        if (val == null) return '""';
        if (typeof val === "string" || typeof val === "number") return `"${String(val).replace(/"/g, '""')}"`;
        return '""';
      })
      .join(","),
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
