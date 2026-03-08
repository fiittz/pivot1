export interface BudgetCategory {
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
}

export interface Budget {
  id: string;
  name: string;
  period: "monthly" | "quarterly" | "annual";
  startDate: string;
  categories: BudgetCategory[];
  totalLimit: number;
  createdAt: string;
}

export interface BudgetProgress {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  actual: number;
  remaining: number;
  percentUsed: number;
  status: "on_track" | "warning" | "over_budget";
}

export interface ForecastPoint {
  month: string;
  projected: number;
  actual?: number;
  budgeted: number;
}
