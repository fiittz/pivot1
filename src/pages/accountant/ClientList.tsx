import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Button } from "@/components/ui/button";
import { ClientStatusBadge } from "@/components/accountant/ClientStatusBadge";
import {
  DataTable,
  StatusPipelineTabs,
  TableActionBar,
} from "@/components/accountant/table";
import type { ColumnDef } from "@/components/accountant/table";
import type { PipelineTab } from "@/components/accountant/table";
import {
  useAccountantClients,
  useAccountantClientCounts,
} from "@/hooks/accountant/useAccountantClients";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSelection } from "@/hooks/useTableSelection";
import { Plus, Users, Archive } from "lucide-react";
import type { AccountantClient, ClientStatus } from "@/types/accountant";

type FilterTab = "all" | ClientStatus;

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const columns: ColumnDef<AccountantClient>[] = [
  {
    id: "name",
    header: "Name",
    sortField: "client_name",
    width: "min-w-[180px]",
    accessorFn: (row) => {
      const initials = row.client_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      return (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#E8930C]/10 border border-[#E8930C]/30 flex items-center justify-center text-[10px] font-semibold text-[#E8930C] shrink-0">
            {initials}
          </div>
          <span className="font-medium text-foreground truncate">{row.client_name}</span>
        </div>
      );
    },
  },
  {
    id: "business",
    header: "Business",
    sortField: "client_business_name",
    width: "w-48",
    accessorFn: (row) => (
      <span className="text-muted-foreground truncate block">
        {row.client_business_name || "\u2014"}
      </span>
    ),
  },
  {
    id: "email",
    header: "Email",
    sortField: "client_email",
    width: "w-52",
    accessorFn: (row) => (
      <span className="text-muted-foreground truncate block text-xs">
        {row.client_email}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: "w-28",
    accessorFn: (row) => (
      <ClientStatusBadge status={row.status as ClientStatus} />
    ),
  },
  {
    id: "engagement",
    header: "Engagement",
    width: "w-28",
    accessorFn: (row) => (
      <span className="text-muted-foreground text-xs">
        {row.engagement_type || "\u2014"}
      </span>
    ),
  },
  {
    id: "fee",
    header: "Fee",
    sortField: "fee_amount",
    width: "w-24",
    align: "right",
    accessorFn: (row) => (
      <span className="text-foreground text-xs tabular-nums">
        {row.fee_amount != null
          ? `\u20AC${row.fee_amount.toLocaleString("en-IE", { minimumFractionDigits: 0 })}`
          : "\u2014"}
      </span>
    ),
  },
  {
    id: "year_end",
    header: "Year End",
    width: "w-20",
    align: "center",
    accessorFn: (row) => (
      <span className="text-muted-foreground text-xs">
        {row.year_end_month ? MONTH_NAMES[row.year_end_month] : "\u2014"}
      </span>
    ),
  },
];

const ClientList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const statusFilter = activeFilter === "all" ? undefined : activeFilter;
  const { data: clients = [], isLoading } = useAccountantClients({
    status: statusFilter,
    search: search || undefined,
  });
  const { data: counts } = useAccountantClientCounts();

  const { sortField, sortDir, onSort, sortData } = useTableSort<AccountantClient>();
  const {
    selectedIds,
    toggle,
    toggleAll,
    clear,
    isAllSelected,
    selectedCount,
  } = useTableSelection();

  const sortedClients = sortData(clients);

  const pipelineTabs: PipelineTab<FilterTab>[] = [
    { key: "all", label: "All", count: counts?.total || 0 },
    { key: "active", label: "Active", count: counts?.active || 0 },
    { key: "pending_invite", label: "Pending", count: counts?.pending || 0 },
    { key: "archived", label: "Archived", count: counts?.archived || 0 },
  ];

  const handleTabChange = (tab: FilterTab) => {
    setActiveFilter(tab);
    clear();
  };

  const handleRowClick = (client: AccountantClient) => {
    if (client.client_user_id) {
      navigate(`/accountant/clients/${client.client_user_id}`);
    }
  };

  return (
    <AccountantLayout>
      <div className="space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Clients</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Manage your client relationships and invitations.
            </p>
          </div>
        </div>

        {/* Pipeline tabs */}
        <StatusPipelineTabs
          tabs={pipelineTabs}
          activeTab={activeFilter}
          onTabChange={handleTabChange}
        />

        {/* Action bar */}
        <TableActionBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email, or business..."
          selectedCount={selectedCount}
          bulkActions={
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </Button>
          }
          actions={
            <Button
              onClick={() => navigate("/accountant/clients/invite")}
              className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white rounded-md shadow-none gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Invite Client
            </Button>
          }
        />

        {/* Data table */}
        <DataTable
          columns={columns}
          data={sortedClients}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          emptyIcon={<Users className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage={
            search || activeFilter !== "all" ? "No clients found" : "No clients yet"
          }
          emptyDescription={
            search || activeFilter !== "all"
              ? "Try adjusting your search or filter."
              : "Invite your first client to get started."
          }
          onRowClick={handleRowClick}
          selectable
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          isAllSelected={isAllSelected(sortedClients.map((c) => c.id))}
          sortField={sortField}
          sortDir={sortDir}
          onSort={onSort}
        />
      </div>
    </AccountantLayout>
  );
};

export default ClientList;
