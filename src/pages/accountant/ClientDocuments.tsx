import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientReceipts, useClientInvoices } from "@/hooks/accountant/useClientData";
import {
  useDocumentRequestsByClient,
  useCreateDocumentRequest,
  useUpdateDocumentRequest,
  useDeleteDocumentRequest,
  type DocumentRequestStatus,
} from "@/hooks/accountant/useDocumentRequests";
import { DocumentRequestForm } from "@/components/accountant/DocumentRequestForm";
import {
  Receipt,
  FileText,
  Image,
  Calendar,
  Plus,
  FolderSearch,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ClientDocumentsProps {
  clientUserId: string | null | undefined;
  accountantClientId?: string;
}

const ClientDocuments = ({ clientUserId, accountantClientId }: ClientDocumentsProps) => {
  const [tab, setTab] = useState<"receipts" | "invoices" | "requests">("receipts");
  const { data: receipts = [], isLoading: receiptsLoading } = useClientReceipts(clientUserId);
  const { data: invoices = [], isLoading: invoicesLoading } = useClientInvoices(clientUserId);
  const { data: requests = [], isLoading: requestsLoading } = useDocumentRequestsByClient(accountantClientId);
  const createRequest = useCreateDocumentRequest();
  const updateRequest = useUpdateDocumentRequest();
  const deleteRequest = useDeleteDocumentRequest();
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);

  const pendingRequests = requests.filter((r) => r.status === "pending").length;

  const isLoading =
    tab === "receipts" ? receiptsLoading : tab === "invoices" ? invoicesLoading : requestsLoading;

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

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1">
        <button
          onClick={() => setTab("receipts")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "receipts" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Receipts ({receipts.length})
        </button>
        <button
          onClick={() => setTab("invoices")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "invoices" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Invoices ({invoices.length})
        </button>
        {accountantClientId && (
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "requests" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <FolderSearch className="w-3.5 h-3.5" />
            Requests
            {pendingRequests > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#E8930C]/10 text-[#E8930C]">
                {pendingRequests}
              </span>
            )}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
      ) : tab === "receipts" ? (
        /* Receipts */
        receipts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Receipt className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              No receipts uploaded by this client.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {receipts.map((r) => {
              const receipt = r as Record<string, unknown>;
              return (
                <Card key={receipt.id as string} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
                        <Image className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(receipt.supplier_name as string) || "Unknown Supplier"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {(receipt.receipt_date as string) || (receipt.created_at as string)?.slice(0, 10) || "—"}
                        </div>
                        {receipt.total_amount && (
                          <p className="text-sm font-semibold mt-1">
                            {formatCurrency(Number(receipt.total_amount))}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : tab === "invoices" ? (
        /* Invoices */
        invoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              No invoices created by this client.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {invoices.map((inv) => {
                  const invoice = inv as Record<string, unknown>;
                  const customer = invoice.customer as { name: string } | null;
                  const status = (invoice.status as string) ?? "draft";
                  return (
                    <div key={invoice.id as string} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            #{invoice.invoice_number as string}
                          </p>
                          <InvoiceStatusBadge status={status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {customer?.name ?? "No customer"} · {invoice.invoice_date as string}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(invoice.total) || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        /* Document Requests */
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => setFormOpen(true)}
              size="sm"
              className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Request
            </Button>
          </div>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FolderSearch className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                No document requests yet. Request missing documents from your client.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {requests.map((req) => (
                    <div key={req.id} className="flex items-start gap-3 px-4 py-3">
                      <RequestStatusIcon status={req.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{req.title}</p>
                          <RequestStatusBadge status={req.status} />
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {req.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {req.category && <span>{req.category}</span>}
                          {req.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {req.due_date}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {req.status === "uploaded" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-emerald-500 hover:text-emerald-600"
                              onClick={() => handleAccept(req.id)}
                              title="Accept"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 text-red-500 hover:text-red-600"
                              onClick={() => handleReject(req.id)}
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {req.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(req.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <DocumentRequestForm
            open={formOpen}
            onOpenChange={setFormOpen}
            onSave={handleCreateRequest}
            isSaving={createRequest.isPending}
          />
        </div>
      )}
    </div>
  );
};

function RequestStatusIcon({ status }: { status: DocumentRequestStatus }) {
  const icons: Record<DocumentRequestStatus, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-amber-500" />,
    uploaded: <Upload className="w-4 h-4 text-blue-500" />,
    accepted: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    rejected: <XCircle className="w-4 h-4 text-red-500" />,
  };
  return (
    <div className="mt-0.5 shrink-0">{icons[status]}</div>
  );
}

function RequestStatusBadge({ status }: { status: DocumentRequestStatus }) {
  const config: Record<DocumentRequestStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500",
    uploaded: "bg-blue-500/10 text-blue-500",
    accepted: "bg-emerald-500/10 text-emerald-500",
    rejected: "bg-red-500/10 text-red-500",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config[status]}`}>
      {status}
    </Badge>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-500",
    sent: "bg-blue-500/10 text-blue-500",
    paid: "bg-emerald-500/10 text-emerald-500",
    overdue: "bg-red-500/10 text-red-500",
    cancelled: "bg-gray-500/10 text-gray-400",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${colorMap[status] ?? ""}`}>
      {status}
    </Badge>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientDocuments;
