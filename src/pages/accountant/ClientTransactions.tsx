import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DataTable,
  StatusPipelineTabs,
  TableActionBar,
} from "@/components/accountant/table";
import type { ColumnDef } from "@/components/accountant/table";
import type { PipelineTab } from "@/components/accountant/table";
import {
  useClientTransactions,
  useClientCategories,
  useClientReceipts,
} from "@/hooks/accountant/useClientData";
import { useUpdateTransactionCategory } from "@/hooks/accountant/useClientData";
import { useCreateDocumentRequest } from "@/hooks/accountant/useDocumentRequests";
import { useTableSelection } from "@/hooks/useTableSelection";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  User,
  Wallet,
  MoreHorizontal,
  Receipt,
  FileText,
  FilePlus,
  Image,
  Paperclip,
  ChevronDown,
} from "lucide-react";
import { isVATDeductible } from "@/lib/vatDeductibility";

interface ClientTransactionsProps {
  clientUserId: string | null | undefined;
  accountantClientId?: string;
  accountType?: string;
  isVatRegistered?: boolean;
}

type TypeFilter = "all" | "income" | "expense";

interface TransactionRow {
  id: string;
  type: string;
  transaction_date: string;
  description: string | null;
  reference: string | null;
  category: { id: string; name: string } | null;
  amount: number;
  category_id: string | null;
  vat_amount: number | null;
  vat_rate: number | null;
  is_reconciled: boolean | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

const ClientTransactions = ({
  clientUserId,
  accountantClientId,
  accountType,
  isVatRegistered = false,
}: ClientTransactionsProps) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  const [otherComment, setOtherComment] = useState("");
  const [otherDialogTarget, setOtherDialogTarget] = useState<TransactionRow[] | null>(null);
  const { toast } = useToast();

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: rawTransactions = [], isLoading } = useClientTransactions(clientUserId, {
    type: typeFilter === "all" ? undefined : typeFilter,
    startDate,
    endDate,
    accountType,
  });
  const { data: categories = [] } = useClientCategories(clientUserId, undefined, accountType);
  const updateCategory = useUpdateTransactionCategory(clientUserId);
  const createDocRequest = useCreateDocumentRequest();
  const { data: receipts = [] } = useClientReceipts(clientUserId);

  const transactions: TransactionRow[] = rawTransactions.map((t: Record<string, unknown>) => ({
    id: t.id as string,
    type: t.type as string,
    transaction_date: t.transaction_date as string,
    description: t.description as string | null,
    reference: t.reference as string | null,
    category: t.category as { id: string; name: string } | null,
    amount: Number(t.amount) || 0,
    category_id: t.category_id as string | null,
    vat_amount: t.vat_amount != null ? Number(t.vat_amount) : null,
    vat_rate: t.vat_rate != null ? Number(t.vat_rate) : null,
    is_reconciled: t.is_reconciled as boolean | null,
  }));

  // Build receipt lookup map by transaction_id
  const receiptMap = useMemo(() => {
    const map = new Map<string, { vendor_name: string | null; amount: number | null; receipt_date: string | null }>();
    for (const r of receipts as Record<string, unknown>[]) {
      const txId = r.transaction_id as string | null;
      if (txId) {
        map.set(txId, {
          vendor_name: r.vendor_name as string | null,
          amount: r.amount as number | null,
          receipt_date: r.receipt_date as string | null,
        });
      }
    }
    return map;
  }, [receipts]);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        (t.reference ?? "").toLowerCase().includes(q) ||
        (t.category?.name ?? "").toLowerCase().includes(q),
    );
  }, [transactions, search]);

  // Group by category, sort by VAT rate descending within each group
  const groupedAndSorted = useMemo(() => {
    const groups = new Map<string, TransactionRow[]>();

    for (const t of filtered) {
      const key = t.category?.name ?? "Uncategorised";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    // Sort each group by VAT rate descending
    for (const rows of groups.values()) {
      rows.sort((a, b) => (b.vat_rate ?? -1) - (a.vat_rate ?? -1));
    }

    // Named categories alphabetically, uncategorised last
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === "Uncategorised") return 1;
      if (b === "Uncategorised") return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.flatMap((key) => groups.get(key)!);
  }, [filtered]);

  const { selectedIds, toggle, toggleAll, clear, isAllSelected, selectedCount } =
    useTableSelection();

  const totalIncome = rawTransactions
    .filter((t: Record<string, unknown>) => t.type === "income")
    .reduce((sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalExpenses = rawTransactions
    .filter((t: Record<string, unknown>) => t.type === "expense")
    .reduce((sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalVat = rawTransactions.reduce(
    (sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.vat_amount) || 0),
    0,
  );

  const incomeCount = rawTransactions.filter((t: Record<string, unknown>) => t.type === "income").length;
  const expenseCount = rawTransactions.filter((t: Record<string, unknown>) => t.type === "expense").length;

  const accountLabel =
    accountType === "directors_personal_tax"
      ? "Personal Tax"
      : accountType === "limited_company"
        ? "Company"
        : null;

  const pipelineTabs: PipelineTab<TypeFilter>[] = [
    { key: "all", label: "All", count: rawTransactions.length },
    { key: "income", label: "Income", count: incomeCount },
    { key: "expense", label: "Expenses", count: expenseCount },
  ];

  const handleTabChange = (tab: TypeFilter) => {
    setTypeFilter(tab);
    clear();
  };

  const handleCategoryChange = (txId: string, categoryId: string) => {
    updateCategory.mutate({ transactionId: txId, categoryId });
  };

  const handleRequestDocument = (row: TransactionRow, category: string) => {
    if (!accountantClientId || !clientUserId) {
      toast({ title: "Cannot create request", description: "Client not linked.", variant: "destructive" });
      return;
    }
    const desc = row.description || "Unknown";
    const amt = formatCurrency(Math.abs(row.amount));
    createDocRequest.mutate(
      {
        accountant_client_id: accountantClientId,
        client_user_id: clientUserId,
        title: `${category} for ${desc}`,
        description: `Please provide the ${category.toLowerCase()} for the transaction: ${desc} on ${row.transaction_date} for ${amt}.`,
        category,
      },
      {
        onSuccess: () => toast({ title: `${category} requested`, description: `Request sent for "${desc}"` }),
      },
    );
  };

  const handleBulkRequestDocument = (category: string) => {
    if (!accountantClientId || !clientUserId) {
      toast({ title: "Cannot create request", description: "Client not linked.", variant: "destructive" });
      return;
    }

    const selectedTxs = groupedAndSorted.filter((t) => selectedIds.has(t.id));
    for (const row of selectedTxs) {
      const desc = row.description || "Unknown";
      const amt = formatCurrency(Math.abs(row.amount));
      createDocRequest.mutate({
        accountant_client_id: accountantClientId,
        client_user_id: clientUserId,
        title: `${category} for ${desc}`,
        description: `Please provide the ${category.toLowerCase()} for the transaction: ${desc} on ${row.transaction_date} for ${amt}.`,
        category,
      });
    }

    toast({
      title: `${category} requested`,
      description: `Request sent for ${selectedCount} transaction${selectedCount !== 1 ? "s" : ""}`,
    });
    clear();
  };

  const openOtherDialog = (targets: TransactionRow[]) => {
    setOtherDialogTarget(targets);
    setOtherComment("");
    setOtherDialogOpen(true);
  };

  const handleOtherDialogSend = () => {
    if (!accountantClientId || !clientUserId || !otherDialogTarget?.length) return;

    for (const row of otherDialogTarget) {
      const desc = row.description || "Unknown";
      const amt = formatCurrency(Math.abs(row.amount));
      createDocRequest.mutate({
        accountant_client_id: accountantClientId,
        client_user_id: clientUserId,
        title: `Other for ${desc}`,
        description: otherComment || `Please provide the other document for the transaction: ${desc} on ${row.transaction_date} for ${amt}.`,
        category: "Other",
      });
    }

    toast({
      title: "Other document requested",
      description: otherDialogTarget.length === 1
        ? `Request sent for "${otherDialogTarget[0].description || "Unknown"}"`
        : `Request sent for ${otherDialogTarget.length} transactions`,
    });

    setOtherDialogOpen(false);
    setOtherDialogTarget(null);
    setOtherComment("");
    clear();
  };

  const columns: ColumnDef<TransactionRow>[] = [
    {
      id: "actions",
      header: "",
      width: "w-8",
      accessorFn: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => handleRequestDocument(row, "Receipt")}>
              Request Receipt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRequestDocument(row, "Invoice")}>
              Request Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRequestDocument(row, "Bank Statement")}>
              Request Bank Statement
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openOtherDialog([row])}>
              Request Other Document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      id: "date",
      header: "Date",
      sortField: "transaction_date",
      width: "w-24",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">{row.transaction_date}</span>
      ),
    },
    {
      id: "supplier",
      header: "Supplier",
      sortField: "description",
      width: "w-56",
      accessorFn: (row) => (
        <div className="min-w-0 -space-y-0.5">
          <span className="text-sm text-foreground truncate block font-medium">
            {row.description || "No description"}
          </span>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Select
              value={row.category_id ?? "uncategorised"}
              onValueChange={(val) => {
                if (val !== "uncategorised") handleCategoryChange(row.id, val);
              }}
            >
              <SelectTrigger className="h-5 w-auto max-w-[180px] text-[10px] px-1.5 py-0 border-none bg-transparent text-muted-foreground hover:text-foreground transition-colors gap-0.5 [&>svg]:w-3 [&>svg]:h-3">
                <SelectValue placeholder="Uncategorised" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat: Record<string, unknown>) => (
                  <SelectItem key={cat.id as string} value={cat.id as string}>
                    {cat.name as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {row.reference && (
              <>
                <span className="text-muted-foreground/30">/</span>
                <span className="text-[10px] text-muted-foreground truncate">
                  {row.reference}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "deductible",
      header: "Deductible",
      width: "w-24",
      align: "center",
      accessorFn: (row) => {
        if (row.type === "income" || (row.vat_amount == null && row.vat_rate == null)) {
          return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
        }
        const result = isVATDeductible(row.description || "", row.category?.name);
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`text-xs font-medium ${
                    result.isDeductible ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {result.isDeductible ? "Yes" : "No"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-xs">
                  {result.section ? `${result.section} — ` : ""}
                  {result.reason}
                </span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      id: "net",
      header: "Net",
      width: "w-28",
      align: "right",
      accessorFn: (row) => {
        const isIncome = row.type === "income";
        const gross = Math.abs(row.amount);
        const vat = row.vat_amount != null ? Math.abs(row.vat_amount) : 0;
        const net = gross - vat;
        return (
          <span
            className={`text-sm tabular-nums ${
              isIncome ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {isIncome ? "+" : "\u2212"}
            {formatCurrency(net)}
          </span>
        );
      },
    },
    {
      id: "vat",
      header: "VAT",
      sortField: "vat_amount",
      width: "w-24",
      align: "right",
      accessorFn: (row) => {
        if (row.vat_amount == null) {
          return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
        }
        return (
          <div className="text-right">
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatCurrency(Math.abs(row.vat_amount))}
            </span>
            {row.vat_rate != null && (
              <span className="text-[10px] text-muted-foreground/60 ml-1">
                ({row.vat_rate}%)
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "gross",
      header: "Gross",
      sortField: "amount",
      width: "w-28",
      align: "right",
      accessorFn: (row) => {
        const isIncome = row.type === "income";
        return (
          <span
            className={`text-sm font-semibold tabular-nums ${
              isIncome ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {isIncome ? "+" : "\u2212"}
            {formatCurrency(Math.abs(row.amount))}
          </span>
        );
      },
    },
    {
      id: "receipt",
      header: "Receipt",
      width: "w-14",
      align: "center",
      accessorFn: (row) => {
        const receipt = receiptMap.get(row.id);
        if (!receipt) {
          return <span className="text-xs text-muted-foreground/40">{"\u2014"}</span>;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Paperclip className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-0.5">
                  {receipt.vendor_name && <p className="font-medium">{receipt.vendor_name}</p>}
                  {receipt.amount != null && <p>{formatCurrency(receipt.amount)}</p>}
                  {receipt.receipt_date && <p>{receipt.receipt_date}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {accountLabel && (
        <Badge variant="secondary" className="gap-1.5">
          {accountType === "limited_company" ? (
            <Building2 className="w-3 h-3" />
          ) : (
            <User className="w-3 h-3" />
          )}
          {accountLabel} Transactions
        </Badge>
      )}

      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-lg border bg-card px-4 py-2.5 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Income</span>
          <span className="font-semibold text-emerald-600">{formatCurrency(totalIncome)}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-semibold text-red-600">{formatCurrency(totalExpenses)}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">VAT</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalVat)}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">{receiptMap.size}</span>
          <span className="text-muted-foreground">/ {rawTransactions.length}</span>
        </div>
      </div>

      {/* Pipeline tabs */}
      <StatusPipelineTabs tabs={pipelineTabs} activeTab={typeFilter} onTabChange={handleTabChange} />

      {/* Action bar with bulk actions */}
      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transactions..."
        selectedCount={selectedCount}
        bulkActions={
          selectedCount > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  Request Document
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => handleBulkRequestDocument("Receipt")}>
                  Request Receipt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkRequestDocument("Invoice")}>
                  Request Invoice
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkRequestDocument("Bank Statement")}>
                  Request Bank Statement
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const selectedTxs = groupedAndSorted.filter((t) => selectedIds.has(t.id));
                  openOtherDialog(selectedTxs);
                }}>
                  Request Other...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      {/* Table with category grouping */}
      <DataTable
        columns={columns}
        data={groupedAndSorted}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        emptyIcon={<Wallet className="w-10 h-10 text-muted-foreground/40" />}
        emptyMessage={`No transactions found for ${taxYear}`}
        selectable
        selectedIds={selectedIds}
        onToggle={toggle}
        onToggleAll={toggleAll}
        isAllSelected={isAllSelected(groupedAndSorted.map((t) => t.id))}
        groupBy={(row) => row.category?.name ?? "Uncategorised"}
        renderGroupHeader={(groupKey, groupRows) => (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${groupKey === "Uncategorised" ? "text-amber-500" : "text-foreground"}`}>
              {groupKey}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {groupRows.length} transaction{groupRows.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      />

      {/* Request Other Document dialog */}
      <Dialog open={otherDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setOtherDialogOpen(false);
          setOtherDialogTarget(null);
          setOtherComment("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Other Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="other-comment">What document do you need?</Label>
            <Textarea
              id="other-comment"
              placeholder="Describe the document you need..."
              value={otherComment}
              onChange={(e) => setOtherComment(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOtherDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleOtherDialogSend}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientTransactions;
