import { useNavigate } from "react-router-dom";
import { AlertTriangle, TrendingUp, Clock, Sparkles, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTransactions } from "@/hooks/useTransactions";
import { useAnomalyDetection, type Insight } from "@/hooks/useAnomalyDetection";

const ICON_MAP: Record<Insight["type"], typeof AlertTriangle> = {
  duplicate: AlertTriangle,
  unusual_amount: TrendingUp,
  stale_uncategorized: Clock,
};

const COLOR_MAP: Record<Insight["severity"], string> = {
  warning: "text-amber-600 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400",
  info: "text-blue-600 bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400",
};

export default function InsightsWidget() {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions({ limit: 500 });
  const { insights, dismissInsight } = useAnomalyDetection(transactions as Record<string, unknown>[]);

  const visibleInsights = insights.slice(0, 5);

  return (
    <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-base font-semibold">Smart Insights</h2>
      </div>

      {visibleInsights.length === 0 ? (
        <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span>No anomalies detected — everything looks good!</span>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleInsights.map((insight) => {
            const Icon = ICON_MAP[insight.type];
            return (
              <div key={insight.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${COLOR_MAP[insight.severity]}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => navigate("/bank")}
                  >
                    Review
                  </Button>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="p-1 rounded-md hover:bg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            );
          })}
          {insights.length > 5 && (
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/bank")}>
              View all {insights.length} insights
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
