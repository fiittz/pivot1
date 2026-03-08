import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useBudgets } from "@/hooks/useBudgets";
import AppLayout from "@/components/layout/AppLayout";
import BudgetSetupCard from "@/components/budget/BudgetSetupCard";
import BudgetProgressCard from "@/components/budget/BudgetProgressCard";
import BudgetForecastChart from "@/components/budget/BudgetForecastChart";

export default function BudgetPage() {
  const { data: transactions = [] } = useTransactions({ limit: 1000 });
  const { data: categories = [] } = useCategories();
  const { activeBudget, createBudget, deleteBudget, progress, forecast, totalBudgeted, totalActual } = useBudgets(transactions as never[]);

  const categoryOptions = (categories as { id: string; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Budgets & Forecasting</h2>
          {activeBudget && (
            <button
              onClick={() => deleteBudget(activeBudget.id)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Reset Budget
            </button>
          )}
        </div>

        {!activeBudget ? (
          <BudgetSetupCard onSave={createBudget} categories={categoryOptions} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <BudgetProgressCard progress={progress} totalBudgeted={totalBudgeted} totalActual={totalActual} />
            <BudgetForecastChart forecast={forecast} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
