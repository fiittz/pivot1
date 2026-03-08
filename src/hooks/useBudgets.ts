import { useState, useMemo, useCallback } from "react";
import type { Budget, BudgetProgress, ForecastPoint } from "@/types/budget";

const STORAGE_KEY = "balnce-budgets";

function loadBudgets(): Budget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBudgets(budgets: Budget[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
}

interface Transaction {
  amount: number;
  type: "income" | "expense" | string;
  category_id?: string;
  category?: { name?: string } | null;
  transaction_date?: string;
}

export function useBudgets(transactions: Transaction[] = []) {
  const [budgets, setBudgets] = useState<Budget[]>(loadBudgets);

  const createBudget = useCallback((budget: Omit<Budget, "id" | "createdAt">) => {
    const newBudget: Budget = {
      ...budget,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setBudgets((prev) => {
      const updated = [...prev, newBudget];
      saveBudgets(updated);
      return updated;
    });
    return newBudget;
  }, []);

  const deleteBudget = useCallback((id: string) => {
    setBudgets((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      saveBudgets(updated);
      return updated;
    });
  }, []);

  const activeBudget = budgets[0] || null;

  const progress = useMemo((): BudgetProgress[] => {
    if (!activeBudget) return [];

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    return activeBudget.categories.map((bc) => {
      const actual = transactions
        .filter((t) => {
          if (t.type !== "expense") return false;
          const tMonth = t.transaction_date?.slice(0, 7);
          if (tMonth !== currentMonth) return false;
          return t.category_id === bc.categoryId || t.category?.name === bc.categoryName;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      const remaining = Math.max(0, bc.monthlyLimit - actual);
      const percentUsed = bc.monthlyLimit > 0 ? (actual / bc.monthlyLimit) * 100 : 0;

      return {
        categoryId: bc.categoryId,
        categoryName: bc.categoryName,
        budgeted: bc.monthlyLimit,
        actual,
        remaining,
        percentUsed,
        status: percentUsed >= 100 ? "over_budget" : percentUsed >= 80 ? "warning" : "on_track",
      };
    });
  }, [activeBudget, transactions]);

  const forecast = useMemo((): ForecastPoint[] => {
    if (!activeBudget) return [];

    const monthlyTotals = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense" || !t.transaction_date) continue;
      const month = t.transaction_date.slice(0, 7);
      monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + Math.abs(t.amount));
    }

    const sorted = Array.from(monthlyTotals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const avgMonthly = sorted.length > 0
      ? sorted.reduce((s, [, v]) => s + v, 0) / sorted.length
      : 0;

    const now = new Date();
    const points: ForecastPoint[] = [];

    for (let i = -3; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const actual = monthlyTotals.get(month);

      points.push({
        month,
        projected: avgMonthly,
        actual,
        budgeted: activeBudget.totalLimit / (activeBudget.period === "annual" ? 12 : activeBudget.period === "quarterly" ? 3 : 1),
      });
    }

    return points;
  }, [activeBudget, transactions]);

  const totalBudgeted = activeBudget?.totalLimit || 0;
  const totalActual = progress.reduce((s, p) => s + p.actual, 0);

  return {
    budgets,
    activeBudget,
    createBudget,
    deleteBudget,
    progress,
    forecast,
    totalBudgeted,
    totalActual,
  };
}
