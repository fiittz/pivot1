import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTransactions, useUnmatchedTransactions } from "@/hooks/useTransactions";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import ClientLayout from "@/components/layout/ClientLayout";
import { OnboardingProgressCard } from "@/components/dashboard/OnboardingProgressCard";
import { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
import { DashboardWidget } from "@/components/dashboard/DashboardWidget";
import { WidgetCustomizeSheet } from "@/components/dashboard/WidgetCustomizeSheet";
import { DeadlinesWidget } from "@/components/dashboard/DeadlinesWidget";
import { DocumentRequestsBanner } from "@/components/dashboard/DocumentRequestsBanner";
import { TrialBalanceFlagsBanner } from "@/components/dashboard/TrialBalanceFlagsBanner";
import { ReconciliationBanner } from "@/components/dashboard/ReconciliationBanner";
import { InboundEmailCard } from "@/components/dashboard/InboundEmailCard";
import InsightsWidget from "@/components/dashboard/InsightsWidget";
import AILearningWidget from "@/components/dashboard/AILearningWidget";
import BookkeepingScoreWidget from "@/components/dashboard/BookkeepingScoreWidget";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import SortableWidget from "@/components/dashboard/SortableWidget";
import { useCategorizationStats } from "@/hooks/useCategorizationStats";
import { useAchievements } from "@/hooks/useAchievements";
import { WidgetId } from "@/types/dashboardWidgets";

const BookkeepingDashboard = () => {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions({ limit: 500 });
  const { data: unmatchedTransactions = [] } = useUnmatchedTransactions();
  const { data: onboarding } = useOnboardingSettings();
  const {
    isLoading: widgetsLoading,
    preferences,
    toggleWidget,
    resetToDefaults,
    isWidgetVisible,
    availableWidgets,
    widgetOrder,
    reorderWidgets,
  } = useDashboardWidgets();

  const isVatRegistered = onboarding?.vat_registered ?? true;
  const isRctIndustry = [
    "construction",
    "forestry",
    "meat_processing",
    "carpentry_joinery",
    "electrical",
    "plumbing_heating",
  ].includes(onboarding?.business_type || "");
  const showRctCards = isRctIndustry && onboarding?.rct_registered;

  const uncategorisedCount = useMemo(
    () =>
      transactions.filter((t: Record<string, unknown>) => !t.category_id).length,
    [transactions],
  );

  const incomeVsExpenses = useMemo(() => {
    const byMonth = new Map<string, { income: number; expenses: number }>();
    (transactions as Record<string, unknown>[]).forEach((t) => {
      if (!t.transaction_date) return;
      const month = String(t.transaction_date).slice(0, 7);
      const entry = byMonth.get(month) || { income: 0, expenses: 0 };
      if (t.type === "income") {
        entry.income += Number(t.amount) || 0;
      } else {
        entry.expenses += Number(t.amount) || 0;
      }
      byMonth.set(month, entry);
    });
    return Array.from(byMonth.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-6);
  }, [transactions]);

  const autoCatStats = useMemo(() => {
    const total = transactions.length;
    if (!total) return { autoPercent: 0, flagged: 0 };
    const categorized = transactions.filter((t: Record<string, unknown>) => t.category_id).length;
    const uncategorized = transactions.filter((t: Record<string, unknown>) => !t.category_id).length;
    return {
      autoPercent: Math.round((categorized / total) * 100),
      flagged: uncategorized,
    };
  }, [transactions]);

  const constructionStats = useMemo(() => {
    if (!isRctIndustry) return null;

    let materials = 0;
    let labour = 0;
    let subcontractors = 0;
    let fuel = 0;

    (transactions as Record<string, unknown>[]).forEach((t) => {
      if (t.type !== "expense") return;
      const amount = Number(t.amount) || 0;
      const catName = String((t.category as Record<string, unknown>)?.name || "").toLowerCase();

      if (catName.includes("material")) {
        materials += amount;
      } else if (catName.includes("labour") || catName.includes("wage") || catName.includes("salary")) {
        labour += amount;
      } else if (catName.includes("subcontractor") || catName.includes("sub-contractor")) {
        subcontractors += amount;
      } else if (catName.includes("fuel") || catName.includes("transport") || catName.includes("motor")) {
        fuel += amount;
      }
    });

    const totalJobCost = materials + labour + subcontractors;

    return { materials, labour, subcontractors, fuel, totalJobCost };
  }, [isRctIndustry, transactions]);

  const catStats = useCategorizationStats(transactions as never[]);
  const { score: bkScore } = useAchievements({
    totalCategorized: autoCatStats.autoPercent > 0 ? Math.round(transactions.length * autoCatStats.autoPercent / 100) : 0,
    totalReceipts: 0,
    totalMatched: 0,
    totalImports: transactions.length > 0 ? 1 : 0,
    vatReturnsCompleted: 0,
    allOnboardingDone: false,
    hasZeroUncategorised: uncategorisedCount === 0 && transactions.length > 0,
  });

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Overview</h2>
          <WidgetCustomizeSheet
            availableWidgets={availableWidgets}
            preferences={preferences}
            onToggle={toggleWidget}
            onReset={resetToDefaults}
          />
        </div>

        <OnboardingProgressCard />
        <DocumentRequestsBanner />
        <TrialBalanceFlagsBanner />
        <ReconciliationBanner />

        {/* Top cards grid — draggable */}
        <DashboardGrid
          widgetOrder={widgetOrder.filter((id) => [
            "bank_feed_status", "uncategorised_transactions", "vat_overview",
            "rct_overview", "pending_tasks", "tax_deadlines", "ai_insights",
            "ai_learning", "bookkeeping_score",
          ].includes(id))}
          onReorder={(newOrder) => {
            // Merge reordered subset back into full order
            const subset = new Set(newOrder);
            const merged = widgetOrder.filter((id) => !subset.has(id as WidgetId));
            const firstIdx = widgetOrder.findIndex((id) => subset.has(id as WidgetId));
            merged.splice(firstIdx >= 0 ? firstIdx : merged.length, 0, ...newOrder as WidgetId[]);
            reorderWidgets(merged as WidgetId[]);
          }}
          renderWidget={(widgetId) => {
            switch (widgetId) {
              case "bank_feed_status":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="bank_feed_status" isVisible={isWidgetVisible("bank_feed_status")} isLoading={widgetsLoading}>
                      <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bank feed</p>
                            <h2 className="text-base font-semibold">Business Accounts</h2>
                          </div>
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Live</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{transactions.length ? "Latest balances synced" : "Import a CSV to get started"}</p>
                        <Button variant="outline" size="sm" className="mt-1 w-fit text-xs" onClick={() => navigate("/bank")}>View Transactions</Button>
                      </div>
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "uncategorised_transactions":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="uncategorised_transactions" isVisible={isWidgetVisible("uncategorised_transactions")} isLoading={widgetsLoading}>
                      <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Review</p>
                        <h2 className="text-base font-semibold">Transactions to Review</h2>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{uncategorisedCount}</span>
                          <span className="text-xs text-muted-foreground">need attention</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {(transactions as Record<string, unknown>[]).filter((t) => !t.category_id).slice(0, 3).map((t) => (
                            <div key={t.id as string} className="flex items-center justify-between border rounded-lg px-2 py-1">
                              <span className="truncate max-w-[60%]">{t.description as string}</span>
                              <span className="font-medium">€{Number(t.amount || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {!transactions.length && <p>No transactions yet. Import a CSV to get started.</p>}
                        </div>
                        <Button size="sm" className="mt-1 w-fit text-xs" onClick={() => navigate("/bank")}>Review Now</Button>
                      </div>
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "vat_overview":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="vat_overview" isVisible={isWidgetVisible("vat_overview")} isLoading={widgetsLoading}>
                      <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">VAT</p>
                        <h2 className="text-base font-semibold">VAT Position</h2>
                        {isVatRegistered ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-muted-foreground">VAT on Sales</span><span className="font-medium">€0.00</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">VAT on Purchases</span><span className="font-medium">€0.00</span></div>
                            <div className="flex justify-between border-t pt-2 mt-1"><span className="font-medium">Net VAT</span><span className="font-bold">€0.00</span></div>
                            <Button size="sm" variant="outline" className="mt-2 w-fit text-xs" onClick={() => navigate("/vat")}>Open VAT Report</Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">You're not VAT-registered — no VAT tracking needed.</p>
                        )}
                      </div>
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "rct_overview":
                if (!showRctCards) return null;
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="rct_overview" isVisible={isWidgetVisible("rct_overview")} isLoading={widgetsLoading}>
                      <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">RCT</p>
                        <h2 className="text-base font-semibold">RCT Overview</h2>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">RCT withheld</span><span className="font-medium">€0.00</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">RCT to pay</span><span className="font-medium">€0.00</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Reverse charge applied</span><span className="font-medium">0 invoices</span></div>
                          <Button size="sm" variant="outline" className="mt-2 w-fit text-xs" onClick={() => navigate("/rct")}>Open RCT Centre</Button>
                        </div>
                      </div>
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "pending_tasks":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="pending_tasks" isVisible={isWidgetVisible("pending_tasks")} isLoading={widgetsLoading}>
                      <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasks</p>
                            <h2 className="text-base font-semibold">Pending Tasks</h2>
                          </div>
                          <span className="px-2 py-1 rounded-full bg-muted text-xs font-medium">{uncategorisedCount + (unmatchedTransactions?.length || 0)} items</span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>{uncategorisedCount} transactions need review</p>
                          <p>{unmatchedTransactions?.length || 0} receipts / unmatched items</p>
                        </div>
                        <Button size="sm" variant="outline" className="mt-1 w-fit text-xs" onClick={() => navigate("/tasks")}>Open Tasks</Button>
                      </div>
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "tax_deadlines":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="tax_deadlines" isVisible={isWidgetVisible("tax_deadlines")} isLoading={widgetsLoading}>
                      <DeadlinesWidget />
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "ai_insights":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="ai_insights" isVisible={isWidgetVisible("ai_insights")} isLoading={widgetsLoading}>
                      <InsightsWidget />
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "ai_learning":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="ai_learning" isVisible={isWidgetVisible("ai_learning")} isLoading={widgetsLoading}>
                      <AILearningWidget
                        categorizationRate={catStats.categorizationRate}
                        aiAccuracy={catStats.aiAccuracy}
                        confidenceDistribution={catStats.confidenceDistribution}
                        totalTransactions={catStats.totalTransactions}
                      />
                    </DashboardWidget>
                  </SortableWidget>
                );
              case "bookkeeping_score":
                return (
                  <SortableWidget key={widgetId} id={widgetId}>
                    <DashboardWidget widgetId="bookkeeping_score" isVisible={isWidgetVisible("bookkeeping_score")} isLoading={widgetsLoading}>
                      <BookkeepingScoreWidget score={bkScore} />
                    </DashboardWidget>
                  </SortableWidget>
                );
              default:
                return null;
            }
          }}
        />

        {/* Construction-specific widgets */}
        {isRctIndustry && constructionStats && (
          <DashboardWidget
            widgetId="construction_materials_labour"
            isVisible={isWidgetVisible("construction_materials_labour")}
            isLoading={widgetsLoading}
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-card rounded-xl p-5 border flex flex-col gap-3 md:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Materials vs Labour</h2>
                  <span className="text-xs text-muted-foreground">Construction snapshot</span>
                </div>
                {constructionStats.totalJobCost > 0 ? (
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Materials</span>
                      <span className="font-medium">€{constructionStats.materials.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Labour</span>
                      <span className="font-medium">€{constructionStats.labour.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subcontractors</span>
                      <span className="font-medium">€{constructionStats.subcontractors.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 mt-1">
                      <span className="font-medium">Total job costs</span>
                      <span className="font-bold">€{constructionStats.totalJobCost.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    Categorise expenses as Materials, Labour, Subcontractors and Fuel to see your job cost mix.
                  </p>
                )}
              </div>

              <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
                <h2 className="text-base font-semibold">Fuel usage</h2>
                {constructionStats.fuel > 0 ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Fuel spend (YTD)</span>
                      <span className="font-medium">€{constructionStats.fuel.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fuel is automatically detected from your bank feed.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Fuel spend will appear here once fuel transactions are imported.
                  </p>
                )}
              </div>
            </div>
          </DashboardWidget>
        )}

        {/* Charts and automation row */}
        <div className="grid gap-4 md:grid-cols-3">
          <DashboardWidget
            widgetId="income_vs_expenses_chart"
            isVisible={isWidgetVisible("income_vs_expenses_chart")}
            isLoading={widgetsLoading}
          >
            <div className="bg-card rounded-xl p-5 border md:col-span-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Income vs Expenses</h2>
                <span className="text-xs text-muted-foreground">Last {incomeVsExpenses.length} months</span>
              </div>
              {incomeVsExpenses.length ? (
                <div className="flex gap-4 items-end h-40">
                  {incomeVsExpenses.map(([month, values]) => {
                    const maxVal = Math.max(values.income, values.expenses, 1);
                    const incomeHeight = (values.income / maxVal) * 100;
                    const expenseHeight = (values.expenses / maxVal) * 100;
                    return (
                      <div key={month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="flex items-end gap-1 w-full">
                          <div className="flex-1 bg-foreground rounded-t-md" style={{ height: `${incomeHeight}%` }} />
                          <div className="flex-1 bg-primary rounded-t-md" style={{ height: `${expenseHeight}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{month}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="h-32 flex items-center justify-center text-xs text-muted-foreground">
                  No data yet. Import a CSV to see monthly trends.
                </p>
              )}
            </div>
          </DashboardWidget>

          <DashboardWidget
            widgetId="automation_insights"
            isVisible={isWidgetVisible("automation_insights")}
            isLoading={widgetsLoading}
          >
            <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
              <h2 className="text-base font-semibold">Automation Insights</h2>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>{autoCatStats.autoPercent}% of transactions auto-categorised</p>
                <p>VAT rules ready based on your onboarding</p>
                {showRctCards && <p>RCT logic enabled for your sector</p>}
                <p>{autoCatStats.flagged} unusual / flagged transactions</p>
              </div>
            </div>
          </DashboardWidget>
        </div>

        {/* Inbound Email Address */}
        <InboundEmailCard />

        {/* Quick Uploads */}
        <div className="bg-card rounded-xl p-5 border flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Quick uploads</h2>
            <p className="text-xs text-muted-foreground">
              Upload CSV files or scan receipts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => navigate("/upload/csv")}
            >
              Upload CSV
            </Button>
            <Button
              size="sm"
              className="text-xs"
            >
              Scan Receipt
            </Button>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
};

export default BookkeepingDashboard;
