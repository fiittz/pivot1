import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { ForecastPoint } from "@/types/budget";

interface Props {
  forecast: ForecastPoint[];
}

export default function BudgetForecastChart({ forecast }: Props) {
  if (!forecast.length) return null;

  const maxVal = Math.max(...forecast.map((f) => Math.max(f.projected, f.actual || 0, f.budgeted)), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Spending Forecast
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-40">
          {forecast.map((f) => {
            const budgetH = (f.budgeted / maxVal) * 100;
            const actualH = f.actual != null ? (f.actual / maxVal) * 100 : 0;
            const projectedH = (f.projected / maxVal) * 100;
            const isPast = f.actual != null;

            return (
              <div key={f.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-0.5 w-full h-32">
                  {isPast ? (
                    <div
                      className="flex-1 bg-primary rounded-t-sm"
                      style={{ height: `${actualH}%` }}
                      title={`Actual: €${f.actual?.toFixed(0)}`}
                    />
                  ) : (
                    <div
                      className="flex-1 bg-primary/30 rounded-t-sm border border-dashed border-primary"
                      style={{ height: `${projectedH}%` }}
                      title={`Projected: €${f.projected.toFixed(0)}`}
                    />
                  )}
                  <div
                    className="w-1 bg-amber-500 rounded-t-sm"
                    style={{ height: `${budgetH}%` }}
                    title={`Budget: €${f.budgeted.toFixed(0)}`}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground">{f.month.slice(5)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" /> Actual</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary/30 border border-primary inline-block" /> Projected</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> Budget</span>
        </div>
      </CardContent>
    </Card>
  );
}
