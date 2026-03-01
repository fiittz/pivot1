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
import { useClientReceipts, useClientInvoices } from "@/hooks/accountant/useClientData";
import {
  useDocumentRequestsByClient,
  useCreateDocumentRequest,
  useUpdateDocumentRequest,
  useDeleteDocumentRequest,
  type DocumentRequestStatus,
  type DocumentRequest,
} from "@/hooks/accountant/useDocumentRequests";
import { DocumentRequestForm } from "@/components/accountant/DocumentRequestForm";
import {
  Receipt,
  FileText,
  FolderSearch,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Trash2,
  Image,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientDocumentsProps {
  clientUserId: string | null | undefined;
  accountantClientId?: string;
}

type DocTab = "receipts" | "invoices" | "requests";

interface ReceiptRow {
  id: string;
  vendor_name: string | null;
  receipt_date: string | null;
  created_at: string | null;
  amount: number | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  status: string;
  total: number;
}

const REQUEST_STATUS_COLORS: Record<DocumentRequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-500",
  uploaded: "bg-blue-500/10 text-blue-500",
  accepted: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-red-500/10 text-red-500",
};

const REQUEST_STATUS_ICONS: Record<DocumentRequestStatus, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  uploaded: <Upload className="w-3.5 h-3.5 text-blue-500" />,
  accepted: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  rejected: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  sent: "bg-blue-500/10 text-blue-500",
  paid: "bg-emerald-500/10 text-emerald-500",
  overdue: "bg-red-500/10 text-red-500",
  cancelled: "bg-gray-500/10 text-gray-400",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

const ClientDocuments = ({ clientUserId, accountantClientId }: ClientDocumentsProps) => {
  const [tab, setTab] = useState<DocTab>("receipts");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const { data: rawReceipts = [], isLoading: receiptsLoading } = useClientReceipts(clientUserId);
  const { data: rawInvoices = [], isLoading: invoicesLoading } = useClientInvoices(clientUserId);
  const { data: requests = [], isLoading: requestsLoading } = useDocumentRequestsByClient(accountantClientId);
  const createRequest = useCreateDocumentRequest();
  const updateRequest = useUpdateDocumentRequest();
  const deleteRequest = useDeleteDocumentRequest();
  const { toast } = useToast();

  const pendingRequests = requests.filter((r) => r.status === "pending").length;

  const receipts: ReceiptRow[] = rawReceipts.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    vendor_name: (r.vendor_name as string) || null,
    receipt_date: (r.receipt_date as string) || (r.created_at as string)?.slice(0, 10) || null,
    created_at: r.created_at as string | null,
    amount: r.amount != null ? Number(r.amount) : null,
  }));

  const invoices: InvoiceRow[] = rawInvoices.map((inv: Record<string, unknown>) => {
    const customer = inv.customer as { name: string } | null;
    return {
      id: inv.id as string,
      invoice_number: inv.invoice_number as string | null,
      customer_name: customer?.name ?? null,
      invoice_date: inv.invoice_date as string | null,
      status: (inv.status as string) ?? "draft",
      total: Number(inv.total) || 0,
    };
  });

  const pipelineTabs: PipelineTab<DocTab>[] = [
    { key: "receipts", label: "Receipts", count: receipts.length },
    { key: "invoices", label: "Invoices", count: invoices.length },
    ...(accountantClientId
      ? [{ key: "requests" as DocTab, label: "Requests", count: pendingRequests }]
      : []),
  ];

  const handleCreateRequest = (data: {
    title: string;
    description?: string;
    category?: string;
    due_date?: string;
  }) => {
    if (!accountantClientId || !clientUserId) return;
    createRequest.mutate(
      { accountant_client_id: accountantClientId, client_user_id: clientUserId, ...data },
      {
        onSuccess: () => {
          setFormOpen(false);
          toast({ title: "Document request sent" });
        },
      },
    );
  };

  const handleAccept = (id: string) => {
    if (!accountantClientId) return;
    updateRequest.mutate(
      { id, accountant_client_id: accountantClientId, status: "accepted" },
      { onSuccess: () => toast({ title: "Document accepted" }) },
    );
  };

  const handleReject = (id: string) => {
    if (!accountantClientId) return;
    updateRequest.mutate(
      { id, accountant_client_id: accountantClientId, status: "rejected", rejection_reason: "Does not match request" },
      { onSuccess: () => toast({ title: "Document rejected" }) },
    );
  };

  const handleDelete = (id: string) => {
    if (!accountantClientId) return;
    deleteRequest.mutate(
      { id, accountant_client_id: accountantClientId },
      { onSuccess: () => toast({ title: "Request deleted" }) },
    );
  };

  // Receipt columns
  const receiptColumns: ColumnDef<ReceiptRow>[] = [
    {
      id: "icon",
      header: "",
      width: "w-10",
      accessorFn: () => (
        <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center">
          <Image className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      width: "min-w-[160px]",
      accessorFn: (row) => (
        <span className="text-sm font-medium text-foreground truncate block">
          {row.vendor_name || "Unknown Supplier"}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      width: "w-28",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground">{row.receipt_date || "\u2014"}</span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      width: "w-24",
      align: "right",
      accessorFn: (row) => (
        <span className="text-sm font-semibold tabular-nums">
          {row.amount != null ? formatCurrency(row.amount) : "\u2014"}
        </span>
      ),
    },
  ];

  // Invoice columns
  const invoiceColumns: ColumnDef<InvoiceRow>[] = [
    {
      id: "number",
      header: "#",
      width: "w-20",
      accessorFn: (row) => (
        <span className="text-sm font-medium text-foreground">
          {row.invoice_number ? `#${row.invoice_number}` : "\u2014"}
        </span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      width: "min-w-[160px]",
      accessorFn: (row) => (
        <span className="text-sm text-foreground truncate block">
          {row.customer_name || "No customer"}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      width: "w-28",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground">{row.invoice_date || "\u2014"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "w-24",
      accessorFn: (row) => (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${INVOICE_STATUS_COLORS[row.status] ?? ""}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      id: "total",
      header: "Total",
      width: "w-24",
      align: "right",
      accessorFn: (row) => (
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.total)}</span>
      ),
    },
  ];

  // Request columns
  const requestColumns: ColumnDef<DocumentRequest>[] = [
    {
      id: "status_icon",
      header: "",
      width: "w-10",
      accessorFn: (row) => REQUEST_STATUS_ICONS[row.status],
    },
    {
      id: "title",
      header: "Title",
      width: "min-w-[180px]",
      accessorFn: (row) => (
        <span className="text-sm font-medium text-foreground">{row.title}</span>
      ),
    },
    {
      id: "category",
      header: "Category",
      width: "w-36",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground">{row.category || "\u2014"}</span>
      ),
    },
    {
      id: "due_date",
      header: "Due",
      width: "w-28",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground">{row.due_date || "\u2014"}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "w-24",
      accessorFn: (row) => (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${REQUEST_STATUS_COLORS[row.status]}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      width: "w-24",
      align: "right",
      accessorFn: (row) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {row.status === "uploaded" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-emerald-500 hover:text-emerald-600"
                onClick={() => handleAccept(row.id)}
                title="Accept"
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-red-500 hover:text-red-600"
                onClick={() => handleReject(row.id)}
                title="Reject"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}
          {row.status === "pending" && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-red-500 hover:text-red-600"
              onClick={() => handleDelete(row.id)}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const isLoading =
    tab === "receipts" ? receiptsLoading : tab === "invoices" ? invoicesLoading : requestsLoading;

  return (
    <div className="space-y-4">
      <StatusPipelineTabs tabs={pipelineTabs} activeTab={tab} onTabChange={(t) => { setTab(t); setSearch(""); }} />

      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${tab}...`}
        actions={
          tab === "requests" ? (
            <Button
              onClick={() => setFormOpen(true)}
              size="sm"
              className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Request
            </Button>
          ) : undefined
        }
      />

      {tab === "receipts" && (
        <DataTable
          columns={receiptColumns}
          data={receipts}
          getRowId={(r) => r.id}
          isLoading={isLoading}
          emptyIcon={<Receipt className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage="No receipts uploaded"
          emptyDescription="No receipts uploaded by this client."
          selectable
        />
      )}

      {tab === "invoices" && (
        <DataTable
          columns={invoiceColumns}
          data={invoices}
          getRowId={(r) => r.id}
          isLoading={isLoading}
          emptyIcon={<FileText className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage="No invoices"
          emptyDescription="No invoices created by this client."
        />
      )}

      {tab === "requests" && (
        <>
          <DataTable
            columns={requestColumns}
            data={requests}
            getRowId={(r) => r.id}
            isLoading={isLoading}
            emptyIcon={<FolderSearch className="w-10 h-10 text-muted-foreground/40" />}
            emptyMessage="No document requests"
            emptyDescription="Request missing documents from your client."
          />
          <DocumentRequestForm
            open={formOpen}
            onOpenChange={setFormOpen}
            onSave={handleCreateRequest}
            isSaving={createRequest.isPending}
          />
        </>
      )}
    </div>
  );
};

export default ClientDocuments;
