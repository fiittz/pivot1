import { useState } from "react";
import AccountantLayout from "@/components/layout/AccountantLayout";
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
  useAllAccountantTasks,
  useAccountantTaskCounts,
  useUpdateTask,
  useDeleteTask,
  type CrossClientTask,
} from "@/hooks/accountant/useClientTasks";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSelection } from "@/hooks/useTableSelection";
import type { TaskStatus, TaskPriority } from "@/types/accountant";
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  Calendar,
  Trash2,
  Check,
} from "lucide-react";

type StatusFilter = "all" | "open" | TaskStatus;

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500/10 text-red-500",
  high: "bg-orange-500/10 text-orange-500",
  medium: "bg-blue-500/10 text-blue-500",
  low: "bg-gray-500/10 text-gray-500",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-500/10 text-gray-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  done: "bg-emerald-500/10 text-emerald-500",
  cancelled: "bg-gray-500/10 text-gray-400",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

const AccountantTasks = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
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
  const deleteTask = useDeleteTask();
  const { sortField, sortDir, onSort, sortData } = useTableSort<CrossClientTask>();
  const { selectedIds, toggle, toggleAll, clear, isAllSelected, selectedCount } =
    useTableSelection();

  const filtered = search
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.client_name.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;
  const sorted = sortData(filtered);

  const handleToggleComplete = (task: CrossClientTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      accountant_client_id: task.accountant_client_id,
      status: newStatus,
    });
  };

  const handleBulkDone = () => {
    sorted
      .filter((t) => selectedIds.has(t.id) && t.status !== "done")
      .forEach((t) =>
        updateTask.mutate({
          id: t.id,
          accountant_client_id: t.accountant_client_id,
          status: "done",
        }),
      );
    clear();
  };

  const handleBulkDelete = () => {
    sorted
      .filter((t) => selectedIds.has(t.id))
      .forEach((t) =>
        deleteTask.mutate({ id: t.id, accountant_client_id: t.accountant_client_id }),
      );
    clear();
  };

  const pipelineTabs: PipelineTab<StatusFilter>[] = [
    { key: "open", label: "Open", count: (counts?.todo ?? 0) + (counts?.in_progress ?? 0) },
    { key: "todo", label: "To Do", count: counts?.todo ?? 0 },
    { key: "in_progress", label: "In Progress", count: counts?.in_progress ?? 0 },
    { key: "done", label: "Done", count: counts?.done ?? 0 },
    { key: "all", label: "All", count: counts?.total ?? 0 },
  ];

  const handleTabChange = (tab: StatusFilter) => {
    setStatusFilter(tab);
    clear();
  };

  const columns: ColumnDef<CrossClientTask>[] = [
    {
      id: "done",
      header: "",
      width: "w-10",
      accessorFn: (row) => (
        <button onClick={(e) => handleToggleComplete(row, e)} className="shrink-0">
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
        <span
          className={`text-sm font-medium ${
            row.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {row.title}
        </span>
      ),
    },
    {
      id: "client",
      header: "Client",
      sortField: "client_name",
      width: "w-44",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground truncate block">
          {row.client_name}
          {row.client_business_name ? ` \u00B7 ${row.client_business_name}` : ""}
        </span>
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
          <span className="text-muted-foreground text-xs">{"\u2014"}</span>
        ),
    },
    {
      id: "due_date",
      header: "Due",
      sortField: "due_date",
      width: "w-28",
      accessorFn: (row) => {
        if (!row.due_date) return <span className="text-muted-foreground text-xs">{"\u2014"}</span>;
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
      id: "status",
      header: "Status",
      width: "w-24",
      accessorFn: (row) => (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[row.status]}`}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
  ];

  return (
    <AccountantLayout>
      <div className="space-y-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Tasks</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage tasks across all your clients.
            </p>
          </div>
        </div>

        <StatusPipelineTabs
          tabs={pipelineTabs}
          activeTab={statusFilter}
          onTabChange={handleTabChange}
        />

        <TableActionBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search tasks or clients..."
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
        />

        <DataTable
          columns={columns}
          data={sorted}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          emptyIcon={<CheckSquare className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage="No tasks"
          emptyDescription="Create tasks from individual client pages."
          selectable
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          isAllSelected={isAllSelected(sorted.map((t) => t.id))}
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </AccountantLayout>
  );
};

export default AccountantTasks;
