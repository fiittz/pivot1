import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useClientTrialBalance,
  type TrialBalanceLine,
} from "@/hooks/accountant/useTrialBalance";

interface ETBExportButtonProps {
  clientUserId: string;
  taxYear: number;
  clientName?: string;
}

// P&L account types
const PL_TYPES = new Set(["Income", "Cost of Sales", "Expense", "Payroll"]);
// Balance Sheet account types
const BS_TYPES = new Set(["Fixed Assets", "Current Assets", "Current Liabilities", "Equity", "VAT", "bank"]);

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatAmount(n: number): string {
  return n === 0 ? "" : n.toFixed(2);
}

export function ETBExportButton({ clientUserId, taxYear, clientName }: ETBExportButtonProps) {
  const { data: tb } = useClientTrialBalance(clientUserId, taxYear);

  const handleExport = () => {
    if (!tb || tb.lines.length === 0) return;

    const headers = [
      "Account Code",
      "Account Name",
      "TB Debit",
      "TB Credit",
      "Adj Debit",
      "Adj Credit",
      "Adjusted TB Debit",
      "Adjusted TB Credit",
      "P&L Debit",
      "P&L Credit",
      "BS Debit",
      "BS Credit",
    ];

    const rows: string[][] = [];

    let totalTBDebit = 0;
    let totalTBCredit = 0;
    let totalAdjDebit = 0;
    let totalAdjCredit = 0;
    let totalAdjTBDebit = 0;
    let totalAdjTBCredit = 0;
    let totalPLDebit = 0;
    let totalPLCredit = 0;
    let totalBSDebit = 0;
    let totalBSCredit = 0;

    for (const line of tb.lines) {
      const tbDebit = line.debit;
      const tbCredit = line.credit;

      // The TB already includes journal adjustments (merged in the hook).
      // For a standalone ETB without a separate adjustments source,
      // adj columns are zero and adjusted = TB.
      const adjDebit = 0;
      const adjCredit = 0;
      const adjustedDebit = tbDebit + adjDebit - adjCredit;
      const adjustedCredit = tbCredit + adjCredit - adjDebit;
      const finalDebit = Math.max(adjustedDebit, 0);
      const finalCredit = Math.max(adjustedCredit, 0);

      // Determine P&L vs BS
      const isPL = PL_TYPES.has(line.accountType);
      const isBS = BS_TYPES.has(line.accountType);

      const plDebit = isPL ? finalDebit : 0;
      const plCredit = isPL ? finalCredit : 0;
      const bsDebit = isBS ? finalDebit : 0;
      const bsCredit = isBS ? finalCredit : 0;

      totalTBDebit += tbDebit;
      totalTBCredit += tbCredit;
      totalAdjDebit += adjDebit;
      totalAdjCredit += adjCredit;
      totalAdjTBDebit += finalDebit;
      totalAdjTBCredit += finalCredit;
      totalPLDebit += plDebit;
      totalPLCredit += plCredit;
      totalBSDebit += bsDebit;
      totalBSCredit += bsCredit;

      rows.push([
        escapeCSV(line.accountCode ?? ""),
        escapeCSV(line.accountName),
        formatAmount(tbDebit),
        formatAmount(tbCredit),
        formatAmount(adjDebit),
        formatAmount(adjCredit),
        formatAmount(finalDebit),
        formatAmount(finalCredit),
        formatAmount(plDebit),
        formatAmount(plCredit),
        formatAmount(bsDebit),
        formatAmount(bsCredit),
      ]);
    }

    // Totals row
    rows.push([
      "",
      "TOTALS",
      formatAmount(totalTBDebit),
      formatAmount(totalTBCredit),
      formatAmount(totalAdjDebit),
      formatAmount(totalAdjCredit),
      formatAmount(totalAdjTBDebit),
      formatAmount(totalAdjTBCredit),
      formatAmount(totalPLDebit),
      formatAmount(totalPLCredit),
      formatAmount(totalBSDebit),
      formatAmount(totalBSCredit),
    ]);

    // Build CSV with BOM for Excel compatibility
    const csvContent =
      "\uFEFF" +
      headers.join(",") +
      "\n" +
      rows.map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (clientName ?? "Client").replace(/[^a-zA-Z0-9]/g, "_");
    link.href = url;
    link.download = `ETB_${safeName}_${taxYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={!tb || tb.lines.length === 0}
      className="gap-1.5"
    >
      <Download className="w-3.5 h-3.5" />
      Export ETB
    </Button>
  );
}
