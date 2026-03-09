import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useClientTransactions } from "@/hooks/accountant/useClientData";
import { useAccountSelector } from "@/hooks/accountant/useAccountSelector";
import { AccountSelectorDropdown } from "@/components/accountant/AccountSelectorDropdown";
import { useClientJournalEntries } from "@/hooks/accountant/useJournalEntries";
import { useFixedAssets, calculateDepreciation, calculateCapitalAllowance } from "@/hooks/accountant/useFixedAssets";
import { useYearEndSnapshot } from "@/hooks/usePriorYearSnapshot";
import { useRCTPaymentNotifications } from "@/hooks/accountant/useRCT";
import { isCTDeductible } from "@/lib/vatDeductibility";

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

interface CTAdjustmentLine {
  name: string;
  amount: number;
  legislation?: string;
}

/**
 * Calculate preliminary CT due dates and amounts.
 *
 * Irish preliminary tax rules:
 * - Small company (prior year CT < €200k): 90% of current year OR 100% of prior year
 * - Large company (prior year CT >= €200k): Two instalments (Month 6 + Month 11)
 * - First year trading: No preliminary tax obligation
 * - ROS filers get +2 days (21st → 23rd)
 */
function calculatePreliminaryTax(
  currentYearCT: number,
  priorYearCT: number,
  taxYear: number,
): {
  method: "small_company" | "large_company" | "first_year";
  amount: number;
  dueDate: string;
  instalments?: { date: string; amount: number }[];
  note: string;
} {
  // First year — no prior year liability
  if (priorYearCT === 0) {
    return {
      method: "first_year",
      amount: 0,
      dueDate: "",
      note: "First year trading — no preliminary tax obligation",
    };
  }

  // Large company: prior year CT >= €200,000
  if (priorYearCT >= 200_000) {
    const instalment1 = currentYearCT * 0.45; // 45% by Month 6
    const instalment2 = currentYearCT * 0.45; // Another 45% by Month 11
    return {
      method: "large_company",
      amount: instalment1 + instalment2,
      dueDate: `23 Jun ${taxYear}`,
      instalments: [
        { date: `23 Jun ${taxYear}`, amount: Math.round(instalment1 * 100) / 100 },
        { date: `23 Nov ${taxYear}`, amount: Math.round(instalment2 * 100) / 100 },
      ],
      note: "Large company — two instalments required (s.958 TCA 1997)",
    };
  }

  // Small company: pay the LOWER of 90% current year or 100% prior year
  const option1 = currentYearCT * 0.9;
  const option2 = priorYearCT;
  const amount = Math.min(option1, option2);

  return {
    method: "small_company",
    amount: Math.round(amount * 100) / 100,
    dueDate: `23 Nov ${taxYear}`,
    note: amount === option2
      ? `100% of prior year CT (${eur(priorYearCT)}) — lower than 90% of current year`
      : `90% of current year CT — lower than 100% of prior year (${eur(priorYearCT)})`,
  };
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

  // Journal entries (depreciation, accruals, bad debts, etc.)
  const { data: journalEntries, isLoading: jeLoading } =
    useClientJournalEntries(clientUserId, taxYear);

  // Fixed assets for capital allowances
  const { data: fixedAssets, isLoading: faLoading } =
    useFixedAssets(clientUserId);

  // Prior year snapshot — for losses forward + prior year CT (preliminary tax calc)
  const { data: priorYearSnapshot, isLoading: pyLoading } =
    useYearEndSnapshot(clientUserId, taxYear - 1);

  // RCT payment notifications — RCT deducted is a CT credit
  const { data: rctNotifications, isLoading: rctLoading } =
    useRCTPaymentNotifications();

  const isLoading = incLoading || expLoading || jeLoading || faLoading || pyLoading || rctLoading;

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

    // ── Merge journal entry lines into P&L ──
    const activeJournals = (journalEntries ?? []).filter(je => !je.is_reversed);
    for (const je of activeJournals) {
      for (const line of je.lines) {
        const accountType = line.account_type;
        const accountName = line.account_name;
        if (accountType === "Income") {
          const amt = (Number(line.credit) || 0) - (Number(line.debit) || 0);
          if (amt !== 0) {
            incomeByCategory.set(accountName, (incomeByCategory.get(accountName) ?? 0) + Math.abs(amt));
          }
        } else if (accountType === "Expense" || accountType === "Payroll") {
          const amt = (Number(line.debit) || 0) - (Number(line.credit) || 0);
          if (amt > 0) {
            if (isCostOfSales(accountName)) {
              cosByCategory.set(accountName, (cosByCategory.get(accountName) ?? 0) + amt);
            } else {
              opexByCategory.set(accountName, (opexByCategory.get(accountName) ?? 0) + amt);
            }
          }
        } else if (accountType === "Cost of Sales") {
          const amt = (Number(line.debit) || 0) - (Number(line.credit) || 0);
          if (amt > 0) {
            cosByCategory.set(accountName, (cosByCategory.get(accountName) ?? 0) + amt);
          }
        }
      }
    }

    const toSorted = (map: Map<string, number>): CategoryLine[] =>
      Array.from(map.entries())
        .map(([name, amount]) => ({ name, amount }))
        .filter(l => l.amount > 0.005)
        .sort((a, b) => b.amount - a.amount);

    const incomeLines = toSorted(incomeByCategory);
    const cosLines = toSorted(cosByCategory);
    const opexLines = toSorted(opexByCategory);

    const totalIncome = incomeLines.reduce((s, l) => s + l.amount, 0);
    const totalCos = cosLines.reduce((s, l) => s + l.amount, 0);
    const grossProfit = totalIncome - totalCos;
    const totalOpex = opexLines.reduce((s, l) => s + l.amount, 0);
    const netProfit = grossProfit - totalOpex;

    // ── CT Adjustments ──────────────────────────────────────────────

    // ADD BACKS: expenses in P&L that are NOT deductible for CT
    const addBacks: CTAdjustmentLine[] = [];
    const allExpenseLines = [...cosLines, ...opexLines];

    for (const line of allExpenseLines) {
      const result = isCTDeductible(line.name, line.name);
      if (!result.isDeductible && result.classification !== "capital") {
        addBacks.push({
          name: line.name,
          amount: line.amount,
          legislation: result.legislation,
        });
      }
    }

    // Description-level add-backs
    const descriptionAddBacks = new Map<string, { amount: number; legislation?: string }>();
    for (const txn of expTxns) {
      const t = txn as Record<string, unknown>;
      const cat = t.category as { id: string; name: string } | null;
      const catName = cat?.name ?? "Uncategorised Expense";
      const desc = (t.description as string) || "";
      const amt = Math.abs(Number(t.amount) || 0);

      if (addBacks.some(ab => ab.name === catName)) continue;

      const result = isCTDeductible(desc, catName);
      if (!result.isDeductible && result.classification !== "capital") {
        const key = result.reason;
        const existing = descriptionAddBacks.get(key);
        if (existing) {
          existing.amount += amt;
        } else {
          descriptionAddBacks.set(key, { amount: amt, legislation: result.legislation });
        }
      }
    }

    for (const [reason, data] of descriptionAddBacks) {
      addBacks.push({ name: reason, amount: data.amount, legislation: data.legislation });
    }

    // Ensure depreciation is added back if in P&L
    const depInPnL = opexLines.find(l => l.name.toLowerCase().includes("depreciation"));
    if (depInPnL && !addBacks.some(ab => ab.name.toLowerCase().includes("depreciation"))) {
      addBacks.push({
        name: "Depreciation (per accounts)",
        amount: depInPnL.amount,
        legislation: "s.81(2)(f) TCA 1997",
      });
    }

    const totalAddBacks = addBacks.reduce((s, l) => s + l.amount, 0);

    // CAPITAL ALLOWANCES from fixed assets
    const capitalAllowances: CTAdjustmentLine[] = [];
    const assets = fixedAssets ?? [];
    const categoryLabels: Record<string, string> = {
      land_and_buildings: "Industrial Buildings (4% x 25 yrs)",
      plant_and_machinery: "Plant & Machinery (12.5% x 8 yrs)",
      fixtures_and_fittings: "Fixtures & Fittings (12.5% x 8 yrs)",
      motor_vehicles: "Motor Vehicles (12.5% x 8 yrs)",
      computer_equipment: "Computer Equipment (12.5% x 8 yrs)",
      office_equipment: "Office Equipment (12.5% x 8 yrs)",
    };

    const allowanceByCategory = new Map<string, number>();
    for (const asset of assets) {
      const ca = calculateCapitalAllowance(asset, taxYear);
      if (ca.annualAllowance > 0 && ca.totalClaimed <= Number(asset.purchase_cost)) {
        const label = categoryLabels[asset.asset_category] ?? asset.asset_category;
        allowanceByCategory.set(label, (allowanceByCategory.get(label) ?? 0) + ca.annualAllowance);
      }
    }

    for (const [name, amount] of allowanceByCategory) {
      if (amount > 0) {
        capitalAllowances.push({ name, amount, legislation: "s.284 TCA 1997" });
      }
    }

    const totalCapitalAllowances = capitalAllowances.reduce((s, l) => s + l.amount, 0);

    // LOSSES FORWARD from prior year
    const lossesForward = priorYearSnapshot?.losses_forward ?? 0;

    // ADJUSTED TAXABLE PROFIT
    const adjustedProfitBeforeLosses = netProfit + totalAddBacks - totalCapitalAllowances;
    const taxableProfit = Math.max(0, adjustedProfitBeforeLosses - lossesForward);
    const lossesUsed = Math.min(lossesForward, Math.max(0, adjustedProfitBeforeLosses));
    const lossesRemaining = lossesForward - lossesUsed;

    // CT LIABILITY @ 12.5% (trading income)
    const ctLiability = Math.round(taxableProfit * 0.125 * 100) / 100;

    // RCT CREDIT — RCT deducted from subcontractor payments is offset against CT
    // Filter to current tax year notifications only
    const rctCredit = (rctNotifications ?? [])
      .filter(n => {
        const notifDate = n.created_at ?? "";
        return notifDate >= startDate && notifDate <= endDate && n.status !== "rejected";
      })
      .reduce((sum, n) => sum + (Number(n.rct_amount) || 0), 0);

    // CT PAYABLE after RCT offset
    const ctAfterRCT = Math.max(0, ctLiability - rctCredit);

    // PRELIMINARY TAX
    const priorYearCT = priorYearSnapshot?.taxation ?? 0;
    const preliminaryTax = calculatePreliminaryTax(ctLiability, priorYearCT, taxYear);

    // BALANCE DUE / REFUNDABLE
    const balanceDue = ctAfterRCT - preliminaryTax.amount;

    return {
      incomeLines,
      cosLines,
      opexLines,
      totalIncome,
      totalCos,
      grossProfit,
      totalOpex,
      netProfit,
      // CT adjustments
      addBacks,
      totalAddBacks,
      capitalAllowances,
      totalCapitalAllowances,
      lossesForward,
      lossesUsed,
      lossesRemaining,
      adjustedProfitBeforeLosses,
      taxableProfit,
      // CT liability
      ctLiability,
      rctCredit,
      ctAfterRCT,
      preliminaryTax,
      balanceDue,
    };
  }, [incomeTransactions, expenseTransactions, journalEntries, fixedAssets, priorYearSnapshot, rctNotifications, hasAccounts, selectedAccountIds, selectedSet, taxYear, startDate, endDate]);

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

  const hasCTAdjustments =
    pnl.addBacks.length > 0 ||
    pnl.capitalAllowances.length > 0 ||
    pnl.lossesForward > 0 ||
    pnl.rctCredit > 0;

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
          <div className="overflow-x-auto">
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

              {/* ═══════════════════════════════════════════════════════════ */}
              {/* ── CORPORATION TAX COMPUTATION ──────────────────────────── */}
              {/* ═══════════════════════════════════════════════════════════ */}
              {hasCTAdjustments && (
                <>
                  <tr><td colSpan={2} className="py-3" /></tr>
                  <tr>
                    <td
                      colSpan={2}
                      className="py-2 px-4 bg-muted/30 border-t-2 border-b"
                    >
                      <span className="font-semibold text-sm">
                        Corporation Tax Computation
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        s.81 TCA 1997
                      </span>
                    </td>
                  </tr>

                  {/* Net profit per accounts */}
                  <tr className="border-b border-muted/20">
                    <td className="py-1.5 px-4 font-medium">
                      Net Profit per Accounts
                    </td>
                    <td className="py-1.5 px-4 text-right font-mono tabular-nums font-medium">
                      {eur(pnl.netProfit)}
                    </td>
                  </tr>

                  {/* ── ADD BACKS ──────────────────── */}
                  {pnl.addBacks.length > 0 && (
                    <>
                      <SectionHeader label="ADD BACKS" />
                      {pnl.addBacks.map((line, idx) => (
                        <AdjustmentRow
                          key={`addback-${idx}`}
                          label={line.name}
                          amount={line.amount}
                          legislation={line.legislation}
                          color="text-amber-600"
                        />
                      ))}
                      <SubtotalRow
                        label="Total Add Backs"
                        amount={pnl.totalAddBacks}
                      />
                    </>
                  )}

                  {/* ── CAPITAL ALLOWANCES ──────────── */}
                  {pnl.capitalAllowances.length > 0 && (
                    <>
                      <SectionHeader label="LESS: CAPITAL ALLOWANCES" />
                      {pnl.capitalAllowances.map((line, idx) => (
                        <AdjustmentRow
                          key={`ca-${idx}`}
                          label={line.name}
                          amount={line.amount}
                          legislation={line.legislation}
                          color="text-blue-600"
                          negative
                        />
                      ))}
                      <SubtotalRow
                        label="Total Capital Allowances"
                        amount={pnl.totalCapitalAllowances}
                        negative
                      />
                    </>
                  )}

                  {/* ── LOSSES FORWARD ──────────────── */}
                  {pnl.lossesForward > 0 && (
                    <>
                      <SectionHeader label="LESS: LOSSES FORWARD" />
                      <AdjustmentRow
                        label={`Losses brought forward from ${taxYear - 1}`}
                        amount={pnl.lossesUsed}
                        legislation="s.396 TCA 1997"
                        color="text-purple-600"
                        negative
                      />
                      {pnl.lossesRemaining > 0 && (
                        <tr className="border-b border-muted/20">
                          <td className="py-1 px-4 pl-8 text-xs text-muted-foreground italic">
                            Losses carried forward to {taxYear + 1}
                          </td>
                          <td className="py-1 px-4 text-right font-mono text-xs text-muted-foreground italic tabular-nums">
                            {eur(pnl.lossesRemaining)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {/* ── TAXABLE PROFIT ──────────────── */}
                  <TotalRow
                    label="TAXABLE TRADING PROFIT"
                    amount={pnl.taxableProfit}
                    bold
                  />

                  {/* ── CT LIABILITY ────────────────── */}
                  {pnl.taxableProfit > 0 && (
                    <>
                      <tr><td colSpan={2} className="py-2" /></tr>
                      <tr>
                        <td
                          colSpan={2}
                          className="py-2 px-4 bg-muted/30 border-t border-b"
                        >
                          <span className="font-semibold text-sm">
                            Tax Liability
                          </span>
                        </td>
                      </tr>

                      <tr className="border-b border-muted/20">
                        <td className="py-1.5 px-4 pl-8">
                          CT @ 12.5% on trading income
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            (s.21A TCA 1997)
                          </span>
                        </td>
                        <td className="py-1.5 px-4 text-right font-mono tabular-nums">
                          {eur(pnl.ctLiability)}
                        </td>
                      </tr>

                      {/* RCT Credit */}
                      {pnl.rctCredit > 0 && (
                        <tr className="border-b border-muted/20">
                          <td className="py-1.5 px-4 pl-8">
                            Less: RCT deducted at source
                            <span className="ml-2 text-[10px] text-muted-foreground">
                              (s.530G TCA 1997)
                            </span>
                          </td>
                          <td className="py-1.5 px-4 text-right font-mono tabular-nums text-blue-600">
                            ({eur(pnl.rctCredit)})
                          </td>
                        </tr>
                      )}

                      {pnl.rctCredit > 0 && (
                        <SubtotalRow
                          label="CT after RCT credit"
                          amount={pnl.ctAfterRCT}
                        />
                      )}

                      {/* Preliminary Tax */}
                      {pnl.preliminaryTax.amount > 0 && (
                        <>
                          <tr className="border-b border-muted/20">
                            <td className="py-1.5 px-4 pl-8">
                              Less: Preliminary tax paid
                              <span className="ml-2 text-[10px] text-muted-foreground">
                                (s.958 TCA 1997)
                              </span>
                            </td>
                            <td className="py-1.5 px-4 text-right font-mono tabular-nums text-blue-600">
                              ({eur(pnl.preliminaryTax.amount)})
                            </td>
                          </tr>

                          {/* Preliminary tax detail */}
                          <tr>
                            <td colSpan={2} className="py-1 px-4 pl-12 text-[11px] text-muted-foreground italic">
                              {pnl.preliminaryTax.note}
                            </td>
                          </tr>
                          {pnl.preliminaryTax.instalments && (
                            <>
                              {pnl.preliminaryTax.instalments.map((inst, idx) => (
                                <tr key={`inst-${idx}`}>
                                  <td className="py-0.5 px-4 pl-12 text-[11px] text-muted-foreground">
                                    Instalment {idx + 1}: due {inst.date}
                                  </td>
                                  <td className="py-0.5 px-4 text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                                    {eur(inst.amount)}
                                  </td>
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      )}

                      {pnl.preliminaryTax.method === "first_year" && (
                        <tr>
                          <td colSpan={2} className="py-1 px-4 pl-8 text-xs text-muted-foreground italic">
                            First year — no preliminary tax obligation
                          </td>
                        </tr>
                      )}

                      {/* ── BALANCE DUE / REFUNDABLE ── */}
                      <TotalRow
                        label={pnl.balanceDue >= 0 ? "BALANCE OF CT DUE" : "CT REFUNDABLE"}
                        amount={pnl.balanceDue}
                        bold
                      />

                      {/* Filing deadline */}
                      <tr>
                        <td colSpan={2} className="py-2 px-4 text-xs text-muted-foreground italic">
                          CT1 filing deadline: 23 Sep {taxYear + 1} (ROS)
                          {pnl.preliminaryTax.dueDate && ` | Preliminary tax due: ${pnl.preliminaryTax.dueDate}`}
                        </td>
                      </tr>
                    </>
                  )}

                  {/* Loss-making year */}
                  {pnl.taxableProfit <= 0 && pnl.adjustedProfitBeforeLosses < 0 && (
                    <tr>
                      <td colSpan={2} className="py-2 px-4 text-xs text-purple-600 italic">
                        Trading loss of {eur(Math.abs(pnl.adjustedProfitBeforeLosses))} — may be carried forward against future profits (s.396 TCA 1997)
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
          </div>
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
  "ADD BACKS": "text-amber-600",
  "LESS: CAPITAL ALLOWANCES": "text-blue-600",
  "LESS: LOSSES FORWARD": "text-purple-600",
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

function AdjustmentRow({
  label,
  amount,
  legislation,
  color,
  negative,
}: {
  label: string;
  amount: number;
  legislation?: string;
  color: string;
  negative?: boolean;
}) {
  return (
    <tr className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
      <td className="py-1.5 px-4 pl-8">
        <span>{label}</span>
        {legislation && (
          <span className="ml-2 text-[10px] text-muted-foreground">
            ({legislation})
          </span>
        )}
      </td>
      <td className={`py-1.5 px-4 text-right font-mono tabular-nums ${color}`}>
        {negative ? `(${eur(amount)})` : eur(amount)}
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
