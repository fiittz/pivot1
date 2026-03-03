import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAllAccountantTasks } from "@/hooks/accountant/useClientTasks";

const priorityClasses: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-secondary text-muted-foreground",
};

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Sunday
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function TasksDueThisWeek() {
  const navigate = useNavigate();
  const { data: tasks, isLoading } = useAllAccountantTasks({ status: ["todo", "in_progress"] });

  const thisWeekTasks = useMemo(() => {
    if (!tasks?.length) return [];
    const { start, end } = getWeekBounds();
    return tasks.filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due >= start && due <= end;
    });
  }, [tasks]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Tasks Due This Week</h3>
          <button
            onClick={() => navigate("/accountant/tasks")}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            All tasks
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-secondary/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : thisWeekTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks due this week</p>
        ) : (
          <div className="space-y-2">
            {thisWeekTasks.map((task) => (
              <button
                key={task.id}
                onClick={() => navigate("/accountant/tasks")}
                className="w-full flex items-center justify-between p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{task.client_name}</p>
                </div>
                <Badge className={`shrink-0 ml-2 text-[10px] ${priorityClasses[task.priority] ?? ""}`}>
                  {task.priority}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
