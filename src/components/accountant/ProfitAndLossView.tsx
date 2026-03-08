import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClientTransactions } from "@/hooks/accountant/useClientData";
import { useAccountSelector } from "@/hooks/accountant/useAccountSelector";
import { AccountSelectorDropdown } from "@/components/accountant/AccountSelectorDropdown";

interface ProfitAndLossViewProps {
  clientUserId: string;
  taxYear: number;
  clientName?: string;
}

const eur = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

/** Categories treated as Cost of Sales (case-insensitive partial match) */
const COST_OF_SALES_KEYWORDS = [
  "cost of sales",
  "cost of goods",
  "materials",
  "stock",
  "purchases",
  "direct cost",
  "subcontract",
  "cogs",
];

function isCostOfSales(categoryName: string): boolean {
  const lower = categoryName.toLowerCase();
  return COST_OF_SALES_KEYWORDS.some((kw) => lower.includes(kw));
}

interface CategoryLine {
  name: string;
  amount: number;
}

export function ProfitAndLossView({
  clientUserId,
  taxYear,
  clientName,
}: ProfitAndLossViewProps) {
  const { selections, selectedAccountIds, toggleAccount, selectAll, deselectAll, hasAccounts } =
    useAccountSelector(clientUserId);

  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: incomeTransactions, isLoading: incLoading } =
    useClientTransactions(clientUserId, {
      type: "income",
      startDate,
      endDate,
    });

  const { data: expenseTransactions, isLoading: expLoading } =
    useClientTransactions(clientUserId, {
      type: "expense",
      startDate,
      endDate,
    });

  const isLoading = incLoading || expLoading;

  // Filter transactions by selected accounts
  const selectedSet = useMemo(() => new Set(selectedAccountIds), [selectedAccountIds]);

  const pnl = useMemo(() => {
    const filterByAccount = (txns: Record<string, unknown>[]) => {
      if (!hasAccounts || selectedAccountIds.length === 0) return txns;
      return txns.filter(t => {
        const accountId = t.account_id as string | null;
        return !accountId || selectedSet.has(accountId);
      });
    };

    const incTxns = filterByAccount((incomeTransactions ?? []) as Record<string, unknown>[]);
    const expTxns = filterByAccount((expenseTransactions ?? []) as Record<string, unknown>[]);

    // Group income by category
    const incomeByCategory = new Map<string, number>();
    for (const txn of incTxns) {
      const t = txn as Record<string, unknown>;
      const cat = t.category as { id: string; name: string } | null;
      const name = cat?.name ?? "Uncategorised Income";
      const amt = Math.abs(Number(t.amount) || 0);
      incomeByCategory.set(name, (incomeByCategory.get(name) ?? 0) + amt);
    }

    // Group expenses by category, splitting COS from operating
    const cosByCategory = new Map<string, number>();
    const opexByCategory = new Map<string, number>();

    for (const txn of expTxns) {
      const t = txn as Record<string, unknown>;
      const cat = t.category as { id: string; name: string } | null;
      const name = cat?.name ?? "Uncategorised Expense";
      const amt = Math.abs(Number(t.amount) || 0);

      if (isCostOfSales(name)) {
        cosByCategory.set(name, (cosByCategory.get(name) ?? 0) + amt);
      } else {
        opexByCategory.set(name, (opexByCategory.get(name) ?? 0) + amt);
      }
    }

    const toSorted = (map: Map<string, number>): CategoryLine[] =>
      Array.from(map.entries())
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount);

    const incomeLines = toSorted(incomeByCategory);
    const cosLines = toSorted(cosByCategory);
    const opexLines = toSorted(opexByCategory);

    const totalIncome = incomeLines.reduce((s, l) => s + l.amount, 0);
    const totalCos = cosLines.reduce((s, l) => s + l.amount, 0);
    const grossProfit = totalIncome - totalCos;
    const totalOpex = opexLines.reduce((s, l) => s + l.amount, 0);
    const netProfit = grossProfit - totalOpex;

    return {
      incomeLines,
      cosLines,
      opexLines,
      totalIncome,
      totalCos,
      grossProfit,
      totalOpex,
      netProfit,
    };
  }, [incomeTransactions, expenseTransactions, hasAccounts, selectedAccountIds, selectedSet]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Computing Profit &amp; Loss...
        </span>
      </div>
    );
  }

  const hasData =
    pnl.incomeLines.length > 0 ||
    pnl.cosLines.length > 0 ||
    pnl.opexLines.length > 0;

  if (!hasData) {
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
          <h3 className="font-semibold text-lg">Profit &amp; Loss Statement</h3>
          <p className="text-xs text-muted-foreground">
            {clientName ?? "Client"} — Year ended 31 Dec {taxYear}
          </p>
        </div>
        {hasAccounts && (
          <AccountSelectorDropdown
            selections={selections}
            onToggle={toggleAccount}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        )}
      </div>

      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-4 font-medium text-xs text-muted-foreground">
                  Description
                </th>
                <th className="text-right py-2 px-4 font-medium text-xs text-muted-foreground w-36">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {/* ── INCOME ─────────────────────────── */}
              <SectionHeader label="INCOME" />
              {pnl.incomeLines.map((line) => (
                <LineRow
                  key={line.name}
                  label={line.name}
                  amount={line.amount}
                  indent
                />
              ))}
              <SubtotalRow label="Total Income" amount={pnl.totalIncome} />

              {/* ── COST OF SALES ──────────────────── */}
              {pnl.cosLines.length > 0 && (
                <>
                  <SectionHeader label="COST OF SALES" />
                  {pnl.cosLines.map((line) => (
                    <LineRow
                      key={line.name}
                      label={line.name}
                      amount={line.amount}
                      indent
                      negative
                    />
                  ))}
                  <SubtotalRow
                    label="Total Cost of Sales"
                    amount={pnl.totalCos}
                    negative
                  />
                </>
              )}

              {/* ── GROSS PROFIT ───────────────────── */}
              <TotalRow label="GROSS PROFIT" amount={pnl.grossProfit} />
              {pnl.totalIncome > 0 && (
                <tr>
                  <td className="py-1 px-4 text-xs text-muted-foreground italic">
                    Gross Margin
                  </td>
                  <td className="py-1 px-4 text-right font-mono text-xs text-muted-foreground italic tabular-nums">
                    {((pnl.grossProfit / pnl.totalIncome) * 100).toFixed(1)}%
                  </td>
                </tr>
              )}

              {/* ── OPERATING EXPENSES ─────────────── */}
              {pnl.opexLines.length > 0 && (
                <>
                  <SectionHeader label="OPERATING EXPENSES" />
                  {pnl.opexLines.map((line) => (
                    <LineRow
                      key={line.name}
                      label={line.name}
                      amount={line.amount}
                      indent
                      negative
                    />
                  ))}
                  <SubtotalRow
                    label="Total Operating Expenses"
                    amount={pnl.totalOpex}
                    negative
                  />
                </>
              )}

              {/* ── NET PROFIT ─────────────────────── */}
              <TotalRow
                label="NET PROFIT BEFORE TAX"
                amount={pnl.netProfit}
                bold
              />
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

const SECTION_COLORS: Record<string, string> = {
  INCOME: "text-emerald-600",
  "COST OF SALES": "text-orange-600",
  "OPERATING EXPENSES": "text-red-500",
};

function SectionHeader({ label }: { label: string }) {
  const color = SECTION_COLORS[label] ?? "text-muted-foreground";
  return (
    <tr>
      <td
        colSpan={2}
        className={`pt-4 pb-1 px-4 text-xs font-semibold uppercase tracking-wider ${color}`}
      >
        {label}
      </td>
    </tr>
  );
}

function LineRow({
  label,
  amount,
  indent,
  negative,
}: {
  label: string;
  amount: number;
  indent?: boolean;
  negative?: boolean;
}) {
  const displayed = negative ? -amount : amount;
  return (
    <tr className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
      <td className={`py-1.5 px-4 ${indent ? "pl-8" : ""}`}>{label}</td>
      <td className="py-1.5 px-4 text-right font-mono tabular-nums">
        {negative && amount > 0 ? `(${eur(amount)})` : eur(displayed)}
      </td>
    </tr>
  );
}

function SubtotalRow({
  label,
  amount,
  negative,
}: {
  label: string;
  amount: number;
  negative?: boolean;
}) {
  return (
    <tr className="border-b border-muted/40">
      <td className="py-1.5 px-4 pl-8 font-medium text-sm">{label}</td>
      <td className="py-1.5 px-4 text-right font-mono font-medium tabular-nums border-t border-muted/40">
        {negative && amount > 0 ? `(${eur(amount)})` : eur(amount)}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  amount,
  bold,
}: {
  label: string;
  amount: number;
  bold?: boolean;
}) {
  const isNegative = amount < 0;
  return (
    <tr className={`border-t-2 ${bold ? "bg-muted/20" : ""}`}>
      <td
        className={`py-2 px-4 ${bold ? "font-bold text-base" : "font-semibold"}`}
      >
        {label}
      </td>
      <td
        className={`py-2 px-4 text-right font-mono tabular-nums ${
          bold ? "font-bold text-base" : "font-semibold"
        } ${isNegative ? "text-red-600" : "text-emerald-600"}`}
      >
        {isNegative ? `(${eur(Math.abs(amount))})` : eur(amount)}
      </td>
    </tr>
  );
}
