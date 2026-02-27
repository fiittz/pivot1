import { useNavigate } from "react-router-dom";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboardDeadlines } from "@/hooks/accountant/useDashboardDeadlines";
import { getStatusClasses } from "@/lib/accountant/deadlineCalculations";

const filingTypeBadge: Record<string, { label: string; className: string }> = {
  ct1: { label: "CT1", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  form11: { label: "Form 11", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  vat: { label: "VAT3", className: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

export function FilingDeadlineTimeline() {
  const navigate = useNavigate();
  const { deadlines, isLoading } = useDashboardDeadlines();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-lg">Upcoming Deadlines</h3>
          </div>
          <button
            onClick={() => navigate("/accountant/filings")}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            All filings
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
        ) : (
          <div className="space-y-3">
            {deadlines.map((d, idx) => {
              const badge = filingTypeBadge[d.filingType];
              return (
                <div
                  key={`${d.filingType}-${d.clientId}-${idx}`}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${badge?.className ?? ""}`}>
                          {badge?.label ?? d.filingType}
                        </Badge>
                        <p className="text-sm font-medium truncate">{d.clientName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(d.dueDate)}</p>
                    </div>
                  </div>
                  <Badge className={`shrink-0 ml-2 ${getStatusClasses(d.status)}`}>{d.daysLabel}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
