import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  StatusPipelineTabs,
  TableActionBar,
} from "@/components/accountant/table";
import type { ColumnDef } from "@/components/accountant/table";
import type { PipelineTab } from "@/components/accountant/table";
import {
  useClientTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/hooks/accountant/useClientTasks";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSelection } from "@/hooks/useTableSelection";
import { ClientTaskForm } from "@/components/accountant/ClientTaskForm";
import type { ClientTask, TaskPriority, TaskStatus } from "@/types/accountant";
import {
  Plus,
  Circle,
  CheckCircle2,
  Calendar,
  ListTodo,
  Pencil,
  Trash2,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientTasksTabProps {
  accountantClientId: string;
}

type TabFilter = "open" | "done" | "all";

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500/10 text-red-500",
  high: "bg-orange-500/10 text-orange-500",
  medium: "bg-blue-500/10 text-blue-500",
  low: "bg-gray-500/10 text-gray-500",
};

const ClientTasksTab = ({ accountantClientId }: ClientTasksTabProps) => {
  const [statusFilter, setStatusFilter] = useState<TabFilter>("open");
  const [search, setSearch] = useState("");
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
  const { sortField, sortDir, onSort, sortData } = useTableSort<ClientTask>();
  const { selectedIds, toggle, toggleAll, clear, isAllSelected, selectedCount } =
    useTableSelection();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);

  const filtered = search
    ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
    : tasks;
  const sorted = sortData(filtered);

  const openCount = tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const pipelineTabs: PipelineTab<TabFilter>[] = [
    { key: "open", label: "Open", count: statusFilter === "open" ? tasks.length : openCount },
    { key: "done", label: "Done", count: statusFilter === "done" ? tasks.length : doneCount },
    { key: "all", label: "All", count: statusFilter === "all" ? tasks.length : openCount + doneCount },
  ];

  const handleCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleEdit = (task: ClientTask, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleToggleComplete = (task: ClientTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      accountant_client_id: accountantClientId,
      status: newStatus,
    });
  };

  const handleDeleteTask = (task: ClientTask, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask.mutate(
      { id: task.id, accountant_client_id: accountantClientId },
      { onSuccess: () => toast({ title: "Task deleted" }) },
    );
  };

  const handleBulkDone = () => {
    sorted
      .filter((t) => selectedIds.has(t.id) && t.status !== "done")
      .forEach((t) =>
        updateTask.mutate({
          id: t.id,
          accountant_client_id: accountantClientId,
          status: "done",
        }),
      );
    clear();
  };

  const handleBulkDelete = () => {
    sorted
      .filter((t) => selectedIds.has(t.id))
      .forEach((t) =>
        deleteTask.mutate({ id: t.id, accountant_client_id: accountantClientId }),
      );
    clear();
  };

  const columns: ColumnDef<ClientTask>[] = [
    {
      id: "done",
      header: "",
      width: "w-10",
      accessorFn: (row) => (
        <button onClick={(e) => handleToggleComplete(row, e)}>
          {row.status === "done" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </button>
      ),
    },
    {
      id: "title",
      header: "Title",
      sortField: "title",
      width: "min-w-[200px]",
      accessorFn: (row) => (
        <div>
          <span
            className={`text-sm font-medium ${
              row.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {row.title}
          </span>
          {row.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      width: "w-24",
      accessorFn: (row) => (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[row.priority]}`}>
          {row.priority}
        </Badge>
      ),
    },
    {
      id: "category",
      header: "Category",
      width: "w-28",
      accessorFn: (row) =>
        row.category ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {row.category}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        ),
    },
    {
      id: "due_date",
      header: "Due",
      sortField: "due_date",
      width: "w-28",
      accessorFn: (row) => {
        if (!row.due_date) return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
        const today = new Date().toISOString().slice(0, 10);
        const isOverdue = row.status !== "done" && row.due_date < today;
        const isDueToday = row.due_date === today;
        return (
          <span
            className={`flex items-center gap-1 text-xs ${
              isOverdue ? "text-red-500 font-medium" : isDueToday ? "text-orange-500" : "text-muted-foreground"
            }`}
          >
            <Calendar className="w-3 h-3" />
            {row.due_date}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      width: "w-20",
      align: "right",
      accessorFn: (row) => (
        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => handleEdit(row, e)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-red-500 hover:text-red-600"
            onClick={(e) => handleDeleteTask(row, e)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatusPipelineTabs
        tabs={pipelineTabs}
        activeTab={statusFilter}
        onTabChange={(t) => { setStatusFilter(t); clear(); }}
      />

      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search tasks..."
        selectedCount={selectedCount}
        bulkActions={
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkDone}>
              <Check className="w-3.5 h-3.5" />
              Mark Done
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-500 hover:text-red-600" onClick={handleBulkDelete}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </>
        }
        actions={
          <Button
            onClick={handleCreate}
            size="sm"
            className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Task
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={sorted}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        emptyIcon={<ListTodo className="w-10 h-10 text-muted-foreground/40" />}
        emptyMessage={statusFilter === "open" ? "No open tasks" : "No tasks found"}
        emptyDescription={
          statusFilter === "open"
            ? "Create one to track work for this client."
            : undefined
        }
        selectable
        selectedIds={selectedIds}
        onToggle={toggle}
        onToggleAll={toggleAll}
        isAllSelected={isAllSelected(sorted.map((t) => t.id))}
        sortField={sortField}
        sortDir={sortDir}
        onSort={onSort}
      />

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

export default ClientTasksTab;
