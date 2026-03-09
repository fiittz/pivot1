import { useMemo } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientTransactions } from "@/hooks/accountant/useClientData";
import { useAccountSelector } from "@/hooks/accountant/useAccountSelector";
import { AccountSelectorDropdown } from "@/components/accountant/AccountSelectorDropdown";

interface BankReconciliationViewProps {
  clientUserId: string;
  taxYear: number;
  clientName?: string;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthRow {
  month: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
  runningBalance: number;
}

export function BankReconciliationView({
  clientUserId,
  taxYear,
  clientName,
}: BankReconciliationViewProps) {
  const { selections, selectedAccountIds, toggleAccount, selectAll, deselectAll, hasAccounts } =
    useAccountSelector(clientUserId);

  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: rawTransactions, isLoading } = useClientTransactions(clientUserId, {
    startDate,
    endDate,
  });

  // Filter transactions by selected accounts
  const selectedSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);

  const transactions = useMemo(() => {
    if (!rawTransactions) return rawTransactions;
    if (!hasAccounts || selectedAccountIds.length === 0) return rawTransactions;
    return rawTransactions.filter(t => {
      const accountId = (t as Record<string, unknown>).account_id as string | null;
      return !accountId || selectedSet.has(accountId);
    });
  }, [rawTransactions, hasAccounts, selectedAccountIds, selectedSet]);

  const {
    totalIncome,
    totalExpenses,
    netMovement,
    monthlyData,
  } = useMemo(() => {
    let income = 0;
    let expenses = 0;
    const monthly: Record<number, { moneyIn: number; moneyOut: number }> = {};

    // Initialize all 12 months
    for (let m = 0; m < 12; m++) {
      monthly[m] = { moneyIn: 0, moneyOut: 0 };
    }

    for (const txn of transactions ?? []) {
      const t = txn as Record<string, unknown>;
      const amount = Math.abs(Number(t.amount) || 0);
      const type = t.type as string;
      const dateStr = t.transaction_date as string;

      let month = 0;
      if (dateStr) {
        const d = new Date(dateStr);
        month = d.getMonth();
      }

      if (type === "income") {
        income += amount;
        monthly[month].moneyIn += amount;
      } else {
        expenses += amount;
        monthly[month].moneyOut += amount;
      }
    }

    // Build monthly rows with running balance
    const rows: MonthRow[] = [];
    let running = 0;
    for (let m = 0; m < 12; m++) {
      const net = monthly[m].moneyIn - monthly[m].moneyOut;
      running += net;
      rows.push({
        month: MONTH_NAMES[m],
        moneyIn: monthly[m].moneyIn,
        moneyOut: monthly[m].moneyOut,
        net,
        runningBalance: running,
      });
    }

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netMovement: income - expenses,
      monthlyData: rows,
    };
  }, [transactions]);

  const isReconciled = Math.abs(netMovement - monthlyData[11]?.runningBalance) < 0.01;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading bank reconciliation...</span>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions found for {taxYear}. Import bank data first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Bank Reconciliation</h3>
          <p className="text-xs text-muted-foreground">
            {clientName ?? "Client"} &mdash; Year ended 31 Dec {taxYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
        {hasAccounts && (
          <AccountSelectorDropdown
            selections={selections}
            onToggle={toggleAccount}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        )}
        <Badge
          variant="outline"
          className={
            isReconciled
              ? "text-emerald-600 border-emerald-300 gap-1"
              : "text-red-600 border-red-300 gap-1"
          }
        >
          {isReconciled ? (
            <>
              <CheckCircle2 className="w-3 h-3" /> Reconciled
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" /> Unreconciled
            </>
          )}
        </Badge>
        </div>
      </div>

      {/* Summary Statement */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <h4 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
            Bank Reconciliation Statement
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            As at 31 December {taxYear}
          </p>

          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between">
              <span>Total income (credits to bank)</span>
              <span className="tabular-nums text-emerald-600">{eur(totalIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total expenses (debits from bank)</span>
              <span className="tabular-nums text-red-500">({eur(totalExpenses)})</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Net bank movement</span>
              <span className={`tabular-nums ${netMovement >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {netMovement < 0 ? `(${eur(Math.abs(netMovement))})` : eur(netMovement)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Monthly Summary
            </h4>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/10">
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Month</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Money In</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Money Out</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Net</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((row) => {
                const hasActivity = row.moneyIn > 0 || row.moneyOut > 0;
                return (
                  <tr
                    key={row.month}
                    className={`border-b border-muted/20 ${
                      hasActivity ? "hover:bg-muted/10" : "opacity-50"
                    } transition-colors`}
                  >
                    <td className="py-1.5 px-3 text-sm">{row.month}</td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums text-emerald-600">
                      {row.moneyIn > 0 ? eur(row.moneyIn) : "\u2014"}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums text-red-500">
                      {row.moneyOut > 0 ? eur(row.moneyOut) : "\u2014"}
                    </td>
                    <td className={`py-1.5 px-3 text-right font-mono tabular-nums ${
                      row.net >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}>
                      {hasActivity
                        ? row.net < 0
                          ? `(${eur(Math.abs(row.net))})`
                          : eur(row.net)
                        : "\u2014"}
                    </td>
                    <td className={`py-1.5 px-3 text-right font-mono tabular-nums font-medium ${
                      row.runningBalance >= 0 ? "" : "text-red-500"
                    }`}>
                      {hasActivity || row.runningBalance !== 0
                        ? row.runningBalance < 0
                          ? `(${eur(Math.abs(row.runningBalance))})`
                          : eur(row.runningBalance)
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2 font-semibold">
                <td className="py-2 px-3">TOTALS</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-600">
                  {eur(totalIncome)}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-red-500">
                  {eur(totalExpenses)}
                </td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums ${
                  netMovement >= 0 ? "text-emerald-600" : "text-red-500"
                }`}>
                  {netMovement < 0 ? `(${eur(Math.abs(netMovement))})` : eur(netMovement)}
                </td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums ${
                  netMovement >= 0 ? "" : "text-red-500"
                }`}>
                  {netMovement < 0 ? `(${eur(Math.abs(netMovement))})` : eur(netMovement)}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction count summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Transactions</p>
            <p className="text-lg font-semibold font-mono tabular-nums">
              {transactions?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Income Transactions</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-emerald-600">
              {(transactions ?? []).filter((t) => (t as Record<string, unknown>).type === "income").length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Expense Transactions</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-red-500">
              {(transactions ?? []).filter((t) => (t as Record<string, unknown>).type === "expense").length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
