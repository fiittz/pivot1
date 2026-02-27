import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useClientTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/hooks/accountant/useClientTasks";
import { ClientTaskForm } from "@/components/accountant/ClientTaskForm";
import type { ClientTask, TaskPriority, TaskStatus } from "@/types/accountant";
import {
  Plus,
  Circle,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Clock,
  Trash2,
  Pencil,
  ListTodo,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientTasksTabProps {
  accountantClientId: string;
}

const ClientTasksTab = ({ accountantClientId }: ClientTasksTabProps) => {
  const [statusFilter, setStatusFilter] = useState<"open" | "done" | "all">("open");
  const queryStatus: TaskStatus[] | undefined =
    statusFilter === "all"
      ? undefined
      : statusFilter === "open"
        ? ["todo", "in_progress"]
        : ["done"];

  const { data: tasks = [], isLoading } = useClientTasks(accountantClientId, {
    status: queryStatus,
  });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);

  const handleCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleEdit = (task: ClientTask) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleSave = (data: {
    title: string;
    description?: string;
    priority: TaskPriority;
    due_date?: string;
    category?: string;
  }) => {
    if (editingTask) {
      updateTask.mutate(
        { id: editingTask.id, accountant_client_id: accountantClientId, ...data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast({ title: "Task updated" });
          },
        },
      );
    } else {
      createTask.mutate(
        { accountant_client_id: accountantClientId, ...data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast({ title: "Task created" });
          },
        },
      );
    }
  };

  const handleToggleComplete = (task: ClientTask) => {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      accountant_client_id: accountantClientId,
      status: newStatus,
    });
  };

  const handleDelete = (task: ClientTask) => {
    deleteTask.mutate(
      { id: task.id, accountant_client_id: accountantClientId },
      { onSuccess: () => toast({ title: "Task deleted" }) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {f === "open" ? "Open" : f === "done" ? "Done" : "All"}
            </button>
          ))}
        </div>
        <Button
          onClick={handleCreate}
          size="sm"
          className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Task
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListTodo className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              {statusFilter === "open"
                ? "No open tasks. Create one to track work for this client."
                : "No tasks found."}
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
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7"
                      onClick={() => handleEdit(task)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(task)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ClientTaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        onSave={handleSave}
        isSaving={createTask.isPending || updateTask.isPending}
      />
    </div>
  );
};

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config: Record<TaskPriority, string> = {
    urgent: "bg-red-500/10 text-red-500",
    high: "bg-orange-500/10 text-orange-500",
    medium: "bg-blue-500/10 text-blue-500",
    low: "bg-gray-500/10 text-gray-500",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config[priority]}`}>
      {priority}
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

export default ClientTasksTab;
