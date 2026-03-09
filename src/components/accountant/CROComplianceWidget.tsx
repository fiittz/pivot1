import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { useCRODeadlines } from "@/hooks/accountant/useCRO";
import { getARStatus } from "@/types/cro";
import type { ARStatus } from "@/types/cro";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const STATUS_CONFIG: Record<ARStatus, { label: string; className: string; icon: typeof Clock }> = {
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 border-red-200",
    icon: AlertTriangle,
  },
  due_soon: {
    label: "Due Soon",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  ok: {
    label: "On Track",
    className: "bg-green-100 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
};

export function CROComplianceWidget() {
  const { data: deadlines, isLoading } = useCRODeadlines();

  const sorted = [...(deadlines ?? [])].sort((a, b) => {
    // nulls (overdue / no date) first, then ascending by date
    if (!a.next_ar_date && !b.next_ar_date) return 0;
    if (!a.next_ar_date) return -1;
    if (!b.next_ar_date) return 1;
    return new Date(a.next_ar_date).getTime() - new Date(b.next_ar_date).getTime();
  });

  const displayed = sorted.slice(0, 5);
  const hasMore = sorted.length > 5;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5" />
          CRO Annual Returns
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : displayed.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No CRO companies linked
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((item) => {
              const status = getARStatus(item.next_ar_date);
              const config = STATUS_CONFIG[status];
              const Icon = config.icon;
              return (
                <div
                  key={item.company_num}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.company_name}</p>
                    <p className="text-xs text-muted-foreground">{item.company_num}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(item.next_ar_date)}
                    </span>
                    <Badge className={`${config.className} flex items-center gap-1`}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{sorted.length - 5} more — View all
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
