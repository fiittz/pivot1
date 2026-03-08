import { Fragment, useMemo } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useClientTrialBalance,
  type TrialBalanceLine,
} from "@/hooks/accountant/useTrialBalance";

interface MultiYearComparisonProps {
  clientUserId: string;
  currentTaxYear: number;
  clientName?: string;
}

const eur = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const eurSigned = (n: number) => {
  if (n === 0) return "—";
  const prefix = n > 0 ? "+" : "";
  return prefix + new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
};

const pctChange = (current: number, prior: number): string => {
  if (prior === 0 && current === 0) return "—";
  if (prior === 0) return "N/A";
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const prefix = pct > 0 ? "+" : "";
  return `${prefix}${pct.toFixed(1)}%`;
};

// P&L account types
const PL_TYPES: Record<string, "income" | "expense"> = {
  Income: "income",
  "Cost of Sales": "expense",
  Expense: "expense",
  Payroll: "expense",
};

// Balance Sheet account types
const BS_TYPES: Record<string, "asset" | "liability" | "equity"> = {
  "Fixed Assets": "asset",
  "Current Assets": "asset",
  bank: "asset",
  VAT: "liability",
  "Current Liabilities": "liability",
  Equity: "equity",
};

interface ComparisonLine {
  name: string;
  accountType: string;
  currentAmount: number;
  priorAmount: number;
}

function buildComparisonMap(lines: TrialBalanceLine[]): Map<string, { debit: number; credit: number; accountType: string }> {
  const map = new Map<string, { debit: number; credit: number; accountType: string }>();
  for (const line of lines) {
    map.set(line.accountName, {
      debit: line.debit,
      credit: line.credit,
      accountType: line.accountType,
    });
  }
  return map;
}

function getNetAmount(line: { debit: number; credit: number; accountType: string }): number {
  // For income accounts (credit normal), return credit amount as positive
  // For expense/asset accounts (debit normal), return debit amount as positive
  return line.debit - line.credit;
}

export function MultiYearComparison({
  clientUserId,
  currentTaxYear,
  clientName,
}: MultiYearComparisonProps) {
  const { data: currentTB, isLoading: currentLoading } = useClientTrialBalance(clientUserId, currentTaxYear);
  const { data: priorTB, isLoading: priorLoading } = useClientTrialBalance(clientUserId, currentTaxYear - 1);

  const isLoading = currentLoading || priorLoading;
  const priorYear = currentTaxYear - 1;
  const hasPriorData = priorTB && priorTB.lines.length > 0;

  const { plLines, bsLines, plSummary, bsSummary } = useMemo(() => {
    const currentMap = currentTB ? buildComparisonMap(currentTB.lines) : new Map();
    const priorMap = priorTB ? buildComparisonMap(priorTB.lines) : new Map();

    // Collect all unique account names
    const allAccounts = new Set([...currentMap.keys(), ...priorMap.keys()]);

    const plLines: ComparisonLine[] = [];
    const bsLines: ComparisonLine[] = [];

    for (const name of allAccounts) {
      const current = currentMap.get(name);
      const prior = priorMap.get(name);
      const accountType = current?.accountType ?? prior?.accountType ?? "";

      const currentNet = current ? getNetAmount(current) : 0;
      const priorNet = prior ? getNetAmount(prior) : 0;

      const line: ComparisonLine = {
        name,
        accountType,
        currentAmount: currentNet,
        priorAmount: priorNet,
      };

      if (accountType in PL_TYPES) {
        plLines.push(line);
      } else if (accountType in BS_TYPES) {
        bsLines.push(line);
      }
    }

    // Sort P&L: Income first, then Cost of Sales, Expense, Payroll
    const plOrder: Record<string, number> = { Income: 1, "Cost of Sales": 2, Expense: 3, Payroll: 4 };
    plLines.sort((a, b) => {
      const oa = plOrder[a.accountType] ?? 99;
      const ob = plOrder[b.accountType] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

    // Sort BS: Fixed Assets, Current Assets, bank, VAT, Current Liabilities, Equity
    const bsOrder: Record<string, number> = {
      "Fixed Assets": 1, "Current Assets": 2, bank: 3,
      VAT: 4, "Current Liabilities": 5, Equity: 6,
    };
    bsLines.sort((a, b) => {
      const oa = bsOrder[a.accountType] ?? 99;
      const ob = bsOrder[b.accountType] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name);
    });

    // P&L summary
    const totalIncomeCurrent = plLines
      .filter((l) => l.accountType === "Income")
      .reduce((sum, l) => sum + l.currentAmount, 0);
    const totalIncomePrior = plLines
      .filter((l) => l.accountType === "Income")
      .reduce((sum, l) => sum + l.priorAmount, 0);
    const totalExpenseCurrent = plLines
      .filter((l) => l.accountType !== "Income")
      .reduce((sum, l) => sum + l.currentAmount, 0);
    const totalExpensePrior = plLines
      .filter((l) => l.accountType !== "Income")
      .reduce((sum, l) => sum + l.priorAmount, 0);

    // Net profit: Income is negative (credit), expenses are positive (debit)
    // So net profit = -(totalIncome) - totalExpenses = |income| - expenses
    const netProfitCurrent = Math.abs(totalIncomeCurrent) - totalExpenseCurrent;
    const netProfitPrior = Math.abs(totalIncomePrior) - totalExpensePrior;

    // BS summary
    const totalAssetsCurrent = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "asset")
      .reduce((sum, l) => sum + l.currentAmount, 0);
    const totalAssetsPrior = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "asset")
      .reduce((sum, l) => sum + l.priorAmount, 0);
    const totalLiabilitiesCurrent = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "liability")
      .reduce((sum, l) => sum + l.currentAmount, 0);
    const totalLiabilitiesPrior = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "liability")
      .reduce((sum, l) => sum + l.priorAmount, 0);
    const totalEquityCurrent = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "equity")
      .reduce((sum, l) => sum + l.currentAmount, 0);
    const totalEquityPrior = bsLines
      .filter((l) => BS_TYPES[l.accountType] === "equity")
      .reduce((sum, l) => sum + l.priorAmount, 0);

    return {
      plLines,
      bsLines,
      plSummary: {
        totalIncomeCurrent: Math.abs(totalIncomeCurrent),
        totalIncomePrior: Math.abs(totalIncomePrior),
        totalExpenseCurrent,
        totalExpensePrior,
        netProfitCurrent,
        netProfitPrior,
      },
      bsSummary: {
        totalAssetsCurrent,
        totalAssetsPrior,
        totalLiabilitiesCurrent: Math.abs(totalLiabilitiesCurrent),
        totalLiabilitiesPrior: Math.abs(totalLiabilitiesPrior),
        totalEquityCurrent: Math.abs(totalEquityCurrent),
        totalEquityPrior: Math.abs(totalEquityPrior),
        netAssetsCurrent: totalAssetsCurrent - Math.abs(totalLiabilitiesCurrent),
        netAssetsPrior: totalAssetsPrior - Math.abs(totalLiabilitiesPrior),
      },
    };
  }, [currentTB, priorTB]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading comparison data...</span>
      </div>
    );
  }

  if (!currentTB || currentTB.lines.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions found for {currentTaxYear}. Import bank data first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg">Year-on-Year Comparison</h3>
        <p className="text-xs text-muted-foreground">
          {clientName ?? "Client"} — {currentTaxYear} vs {priorYear}
          {!hasPriorData && " (no prior year data)"}
        </p>
      </div>

      {/* P&L Comparison */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Profit &amp; Loss Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Account</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">{currentTaxYear}</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">{priorYear}</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Change</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {renderPLSection(plLines, hasPriorData)}

              {/* Total Income */}
              <tr className="border-t font-semibold bg-muted/20">
                <td className="py-1.5 px-3 text-sm">Total Income</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">{eur(plSummary.totalIncomeCurrent)}</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? eur(plSummary.totalIncomePrior) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={plSummary.totalIncomeCurrent} prior={plSummary.totalIncomePrior} hasPrior={!!hasPriorData} />
                </td>
                <td className="py-1.5 px-3 text-right text-xs">
                  <PctCell current={plSummary.totalIncomeCurrent} prior={plSummary.totalIncomePrior} hasPrior={!!hasPriorData} />
                </td>
              </tr>

              {/* Total Expenses */}
              <tr className="border-t font-semibold bg-muted/20">
                <td className="py-1.5 px-3 text-sm">Total Expenses</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">({eur(plSummary.totalExpenseCurrent)})</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? `(${eur(plSummary.totalExpensePrior)})` : "—"}
                </td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={plSummary.totalExpenseCurrent} prior={plSummary.totalExpensePrior} hasPrior={!!hasPriorData} invert />
                </td>
                <td className="py-1.5 px-3 text-right text-xs">
                  <PctCell current={plSummary.totalExpenseCurrent} prior={plSummary.totalExpensePrior} hasPrior={!!hasPriorData} invert />
                </td>
              </tr>

              {/* Net Profit */}
              <tr className="border-t-2 font-bold">
                <td className="py-2 px-3 text-sm">NET PROFIT</td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums text-sm ${plSummary.netProfitCurrent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {eur(plSummary.netProfitCurrent)}
                </td>
                <td className={`py-2 px-3 text-right font-mono tabular-nums text-sm ${!hasPriorData ? "" : plSummary.netProfitPrior >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {hasPriorData ? eur(plSummary.netProfitPrior) : "—"}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={plSummary.netProfitCurrent} prior={plSummary.netProfitPrior} hasPrior={!!hasPriorData} />
                </td>
                <td className="py-2 px-3 text-right text-xs">
                  <PctCell current={plSummary.netProfitCurrent} prior={plSummary.netProfitPrior} hasPrior={!!hasPriorData} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Balance Sheet Comparison */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Balance Sheet Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Account</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">{currentTaxYear}</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">{priorYear}</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Change</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {renderBSSection(bsLines, hasPriorData)}

              {/* Total Assets */}
              <tr className="border-t font-semibold bg-muted/20">
                <td className="py-1.5 px-3 text-sm">Total Assets</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">{eur(bsSummary.totalAssetsCurrent)}</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? eur(bsSummary.totalAssetsPrior) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={bsSummary.totalAssetsCurrent} prior={bsSummary.totalAssetsPrior} hasPrior={!!hasPriorData} />
                </td>
                <td className="py-1.5 px-3 text-right text-xs">
                  <PctCell current={bsSummary.totalAssetsCurrent} prior={bsSummary.totalAssetsPrior} hasPrior={!!hasPriorData} />
                </td>
              </tr>

              {/* Total Liabilities */}
              <tr className="font-semibold bg-muted/20">
                <td className="py-1.5 px-3 text-sm">Total Liabilities</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">({eur(bsSummary.totalLiabilitiesCurrent)})</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? `(${eur(bsSummary.totalLiabilitiesPrior)})` : "—"}
                </td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={bsSummary.totalLiabilitiesCurrent} prior={bsSummary.totalLiabilitiesPrior} hasPrior={!!hasPriorData} invert />
                </td>
                <td className="py-1.5 px-3 text-right text-xs">
                  <PctCell current={bsSummary.totalLiabilitiesCurrent} prior={bsSummary.totalLiabilitiesPrior} hasPrior={!!hasPriorData} invert />
                </td>
              </tr>

              {/* Total Equity */}
              <tr className="font-semibold bg-muted/20">
                <td className="py-1.5 px-3 text-sm">Total Equity</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">{eur(bsSummary.totalEquityCurrent)}</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? eur(bsSummary.totalEquityPrior) : "—"}
                </td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={bsSummary.totalEquityCurrent} prior={bsSummary.totalEquityPrior} hasPrior={!!hasPriorData} />
                </td>
                <td className="py-1.5 px-3 text-right text-xs">
                  <PctCell current={bsSummary.totalEquityCurrent} prior={bsSummary.totalEquityPrior} hasPrior={!!hasPriorData} />
                </td>
              </tr>

              {/* Net Assets */}
              <tr className="border-t-2 font-bold">
                <td className="py-2 px-3 text-sm">NET ASSETS</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">{eur(bsSummary.netAssetsCurrent)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                  {hasPriorData ? eur(bsSummary.netAssetsPrior) : "—"}
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                  <ChangeCell current={bsSummary.netAssetsCurrent} prior={bsSummary.netAssetsPrior} hasPrior={!!hasPriorData} />
                </td>
                <td className="py-2 px-3 text-right text-xs">
                  <PctCell current={bsSummary.netAssetsCurrent} prior={bsSummary.netAssetsPrior} hasPrior={!!hasPriorData} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Helper components ---

function ChangeCell({ current, prior, hasPrior, invert }: { current: number; prior: number; hasPrior: boolean; invert?: boolean }) {
  if (!hasPrior) return <span className="text-muted-foreground">—</span>;
  const diff = current - prior;
  if (Math.abs(diff) < 0.01) return <span className="text-muted-foreground">—</span>;

  // For expenses, an increase is bad (red), decrease is good (green)
  const isPositive = invert ? diff < 0 : diff > 0;
  const color = isPositive ? "text-emerald-600" : "text-red-600";

  return <span className={color}>{eurSigned(diff)}</span>;
}

function PctCell({ current, prior, hasPrior, invert }: { current: number; prior: number; hasPrior: boolean; invert?: boolean }) {
  if (!hasPrior || prior === 0) return <span className="text-muted-foreground">—</span>;
  const diff = current - prior;
  if (Math.abs(diff) < 0.01) return <span className="text-muted-foreground">—</span>;

  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const isPositive = invert ? pct < 0 : pct > 0;
  const color = isPositive ? "text-emerald-600" : "text-red-600";
  const prefix = pct > 0 ? "+" : "";

  return <span className={color}>{prefix}{pct.toFixed(1)}%</span>;
}

const PL_SECTION_LABELS: Record<string, string> = {
  Income: "INCOME",
  "Cost of Sales": "COST OF SALES",
  Expense: "EXPENSES",
  Payroll: "PAYROLL",
};

const PL_TYPE_COLORS: Record<string, string> = {
  Income: "text-emerald-600",
  "Cost of Sales": "text-orange-600",
  Expense: "text-red-500",
  Payroll: "text-red-400",
};

const BS_SECTION_LABELS: Record<string, string> = {
  "Fixed Assets": "FIXED ASSETS",
  "Current Assets": "CURRENT ASSETS",
  bank: "BANK",
  VAT: "VAT",
  "Current Liabilities": "CURRENT LIABILITIES",
  Equity: "EQUITY",
};

const BS_TYPE_COLORS: Record<string, string> = {
  "Fixed Assets": "text-blue-600",
  "Current Assets": "text-blue-500",
  bank: "text-gray-500",
  VAT: "text-purple-500",
  "Current Liabilities": "text-amber-600",
  Equity: "text-indigo-600",
};

function renderPLSection(lines: ComparisonLine[], hasPriorData: boolean | undefined) {
  let lastType = "";
  return lines.map((line, idx) => {
    const showHeader = line.accountType !== lastType;
    lastType = line.accountType;

    // For display: income shows as positive (absolute), expenses show as positive
    const displayCurrent = line.accountType === "Income" ? Math.abs(line.currentAmount) : line.currentAmount;
    const displayPrior = line.accountType === "Income" ? Math.abs(line.priorAmount) : line.priorAmount;

    return (
      <Fragment key={`pl-${idx}`}>
        {showHeader && (
          <tr>
            <td colSpan={5} className="pt-3 pb-1 px-3">
              <span className={`text-xs font-semibold uppercase tracking-wider ${PL_TYPE_COLORS[line.accountType] ?? "text-gray-500"}`}>
                {PL_SECTION_LABELS[line.accountType] ?? line.accountType}
              </span>
            </td>
          </tr>
        )}
        <tr className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
          <td className="py-1.5 px-3 pl-6 text-sm">{line.name}</td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">{eur(displayCurrent)}</td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
            {hasPriorData ? eur(displayPrior) : "—"}
          </td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
            <ChangeCell
              current={displayCurrent}
              prior={displayPrior}
              hasPrior={!!hasPriorData}
              invert={line.accountType !== "Income"}
            />
          </td>
          <td className="py-1.5 px-3 text-right text-xs">
            <PctCell
              current={displayCurrent}
              prior={displayPrior}
              hasPrior={!!hasPriorData}
              invert={line.accountType !== "Income"}
            />
          </td>
        </tr>
      </Fragment>
    );
  });
}

function renderBSSection(lines: ComparisonLine[], hasPriorData: boolean | undefined) {
  let lastType = "";
  return lines.map((line, idx) => {
    const showHeader = line.accountType !== lastType;
    lastType = line.accountType;

    // For liabilities/equity (credit normal), show as positive
    const isCredit = BS_TYPES[line.accountType] === "liability" || BS_TYPES[line.accountType] === "equity";
    const displayCurrent = isCredit ? Math.abs(line.currentAmount) : line.currentAmount;
    const displayPrior = isCredit ? Math.abs(line.priorAmount) : line.priorAmount;

    return (
      <Fragment key={`bs-${idx}`}>
        {showHeader && (
          <tr>
            <td colSpan={5} className="pt-3 pb-1 px-3">
              <span className={`text-xs font-semibold uppercase tracking-wider ${BS_TYPE_COLORS[line.accountType] ?? "text-gray-500"}`}>
                {BS_SECTION_LABELS[line.accountType] ?? line.accountType}
              </span>
            </td>
          </tr>
        )}
        <tr className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
          <td className="py-1.5 px-3 pl-6 text-sm">{line.name}</td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">{eur(displayCurrent)}</td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
            {hasPriorData ? eur(displayPrior) : "—"}
          </td>
          <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
            <ChangeCell current={displayCurrent} prior={displayPrior} hasPrior={!!hasPriorData} />
          </td>
          <td className="py-1.5 px-3 text-right text-xs">
            <PctCell current={displayCurrent} prior={displayPrior} hasPrior={!!hasPriorData} />
          </td>
        </tr>
      </Fragment>
    );
  });
}
