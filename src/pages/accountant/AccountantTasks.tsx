import { useState } from "react";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useAllAccountantTasks,
  useAccountantTaskCounts,
  useUpdateTask,
} from "@/hooks/accountant/useClientTasks";
import type { TaskStatus, TaskPriority } from "@/types/accountant";
import {
  CheckSquare,
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";

type StatusFilter = "all" | "open" | TaskStatus;

const AccountantTasks = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const { data: counts } = useAccountantTaskCounts();

  const queryStatus: TaskStatus[] | undefined =
    statusFilter === "all"
      ? undefined
      : statusFilter === "open"
        ? ["todo", "in_progress"]
        : [statusFilter as TaskStatus];

  const { data: tasks = [], isLoading } = useAllAccountantTasks({
    status: queryStatus,
  });

  const updateTask = useUpdateTask();

  const filterTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "open", label: "Open", count: (counts?.todo ?? 0) + (counts?.in_progress ?? 0) },
    { key: "todo", label: "To Do", count: counts?.todo ?? 0 },
    { key: "in_progress", label: "In Progress", count: counts?.in_progress ?? 0 },
    { key: "done", label: "Done", count: counts?.done ?? 0 },
    { key: "all", label: "All", count: counts?.total ?? 0 },
  ];

  const handleToggleComplete = (task: (typeof tasks)[0]) => {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      accountant_client_id: task.accountant_client_id,
      status: newStatus,
    });
  };

  return (
    <AccountantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Tasks</h2>
          <p className="text-muted-foreground mt-1">
            Manage tasks across all your clients.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === tab.key
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? "text-foreground" : "text-muted-foreground/70"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No tasks</h3>
              <p className="text-muted-foreground text-sm">
                Create tasks from individual client pages.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 px-4 py-3">
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className="mt-0.5 shrink-0"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          task.status === "done"
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {task.client_name}
                          {task.client_business_name ? ` · ${task.client_business_name}` : ""}
                        </span>
                        <PriorityBadge priority={task.priority} />
                        {task.category && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {task.category}
                          </Badge>
                        )}
                        {task.due_date && (
                          <DueDateBadge dueDate={task.due_date} isDone={task.status === "done"} />
                        )}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AccountantLayout>
  );
};

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config: Record<TaskPriority, { color: string; icon: typeof AlertTriangle }> = {
    urgent: { color: "bg-red-500/10 text-red-500", icon: AlertTriangle },
    high: { color: "bg-orange-500/10 text-orange-500", icon: AlertTriangle },
    medium: { color: "bg-blue-500/10 text-blue-500", icon: Clock },
    low: { color: "bg-gray-500/10 text-gray-500", icon: Circle },
  };
  const { color } = config[priority];
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${color}`}>
      {priority}
    </Badge>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const config: Record<TaskStatus, string> = {
    todo: "bg-gray-500/10 text-gray-500",
    in_progress: "bg-blue-500/10 text-blue-500",
    done: "bg-emerald-500/10 text-emerald-500",
    cancelled: "bg-gray-500/10 text-gray-400",
  };
  const labels: Record<TaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
    cancelled: "Cancelled",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 shrink-0 ${config[status]}`}>
      {labels[status]}
    </Badge>
  );
}

function DueDateBadge({ dueDate, isDone }: { dueDate: string; isDone: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && dueDate < today;
  const isDueToday = dueDate === today;

  return (
    <span
      className={`flex items-center gap-1 text-xs ${
        isOverdue
          ? "text-red-500 font-medium"
          : isDueToday
            ? "text-orange-500"
            : "text-muted-foreground"
      }`}
    >
      <Calendar className="w-3 h-3" />
      {dueDate}
    </span>
  );
}

export default AccountantTasks;
