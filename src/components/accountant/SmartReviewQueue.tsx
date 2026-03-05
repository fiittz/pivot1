import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Receipt,
  Mail,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useSmartReviewQueue, type ReviewQueueItem, type Priority } from "@/hooks/accountant/useSmartReviewQueue";

const priorityConfig: Record<Priority, { label: string; color: string; bgColor: string; icon: typeof AlertTriangle }> = {
  high: { label: "High Priority", color: "text-red-700", bgColor: "bg-red-50 border-red-200", icon: AlertTriangle },
  medium: { label: "Needs Attention", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200", icon: Clock },
  low: { label: "On Track", color: "text-green-700", bgColor: "bg-green-50 border-green-200", icon: CheckCircle2 },
};

function ClientRow({ item }: { item: ReviewQueueItem }) {
  const navigate = useNavigate();
  const cfg = priorityConfig[item.priority];

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 border rounded-lg cursor-pointer hover:shadow-sm transition-shadow ${cfg.bgColor}`}
      onClick={() => navigate(`/accountant/clients/${item.clientUserId}`)}
    >
      <div className="flex items-center gap-3 min-w-0">
        <cfg.icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.clientName}</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {item.uncategorisedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <FileText className="h-3 w-3" />
                {item.uncategorisedCount} uncategorised
              </span>
            )}
            {item.missingReceiptsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Receipt className="h-3 w-3" />
                {item.missingReceiptsCount} receipts missing
              </span>
            )}
            {item.pendingEmailReview > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Mail className="h-3 w-3" />
                {item.pendingEmailReview} emails to review
              </span>
            )}
            {item.pendingQuestionnaires > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {item.pendingQuestionnaires} questionnaire{item.pendingQuestionnaires > 1 ? "s" : ""}
              </span>
            )}
            {item.daysUntilDeadline !== null && item.daysUntilDeadline <= 30 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600">
                <Calendar className="h-3 w-3" />
                Year-end in {item.daysUntilDeadline}d
              </span>
            )}
          </div>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export default function SmartReviewQueue() {
  const { data: queue, isLoading } = useSmartReviewQueue();

  const highPriority = queue?.filter((i) => i.priority === "high") ?? [];
  const medium = queue?.filter((i) => i.priority === "medium") ?? [];
  const low = queue?.filter((i) => i.priority === "low") ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Review Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!queue || queue.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All caught up! No clients need attention right now.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Client Review Queue</CardTitle>
          <div className="flex gap-2">
            {highPriority.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {highPriority.length} urgent
              </Badge>
            )}
            {medium.length > 0 && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                {medium.length} attention
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {highPriority.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">
              High Priority ({highPriority.length})
            </p>
            {highPriority.map((item) => (
              <ClientRow key={item.clientId} item={item} />
            ))}
          </div>
        )}

        {medium.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Needs Attention ({medium.length})
            </p>
            {medium.map((item) => (
              <ClientRow key={item.clientId} item={item} />
            ))}
          </div>
        )}

        {low.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">
              On Track ({low.length})
            </p>
            {low.slice(0, 5).map((item) => (
              <ClientRow key={item.clientId} item={item} />
            ))}
            {low.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                + {low.length - 5} more clients on track
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
