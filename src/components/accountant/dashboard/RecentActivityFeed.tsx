import { FileText, CheckCircle2, Upload, StickyNote, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRecentActivity, type ActivityType } from "@/hooks/accountant/useRecentActivity";

const activityIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  filing: FileText,
  task: CheckCircle2,
  document: Upload,
  note: StickyNote,
  client: UserPlus,
};

function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

export function RecentActivityFeed() {
  const { data: items, isLoading } = useRecentActivity();

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-bold text-lg mb-5">Recent Activity</h3>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 bg-secondary/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !items?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 10).map((item) => {
              const Icon = activityIcons[item.type];
              return (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg">
                  <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{item.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.clientName}</span>
                      <span>·</span>
                      <span className="shrink-0">{relativeTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
