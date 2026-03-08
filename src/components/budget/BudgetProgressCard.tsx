import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { BudgetProgress } from "@/types/budget";

interface Props {
  progress: BudgetProgress[];
  totalBudgeted: number;
  totalActual: number;
}

const statusColors: Record<string, string> = {
  on_track: "text-green-600",
  warning: "text-amber-600",
  over_budget: "text-red-600",
};

const progressColors: Record<string, string> = {
  on_track: "[&>div]:bg-green-500",
  warning: "[&>div]:bg-amber-500",
  over_budget: "[&>div]:bg-red-500",
};

export default function BudgetProgressCard({ progress, totalBudgeted, totalActual }: Props) {
  if (!progress.length) return null;

  const overallPercent = totalBudgeted > 0 ? Math.min((totalActual / totalBudgeted) * 100, 100) : 0;
  const overallStatus = overallPercent >= 100 ? "over_budget" : overallPercent >= 80 ? "warning" : "on_track";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Budget Progress</span>
          <span className={`text-sm font-medium ${statusColors[overallStatus]}`}>
            €{totalActual.toFixed(0)} / €{totalBudgeted.toFixed(0)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={overallPercent} className={`h-2 ${progressColors[overallStatus]}`} />

        <div className="space-y-3">
          {progress.map((p) => (
            <div key={p.categoryId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{p.categoryName}</span>
                <span className={statusColors[p.status]}>
                  €{p.actual.toFixed(0)} / €{p.budgeted.toFixed(0)}
                </span>
              </div>
              <Progress value={Math.min(p.percentUsed, 100)} className={`h-1.5 ${progressColors[p.status]}`} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
