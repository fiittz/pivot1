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
  useClientInvoices,
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
import { useAccountantUpsertVATReturn } from "@/hooks/accountant/useAccountantVATReturn";
import { useClientVATReturns } from "@/hooks/accountant/useClientData";
import { CheckCircle2, Landmark } from "lucide-react";

interface ClientTransactionsProps {
  clientUserId: string | null | undefined;
  accountantClientId?: string;
  accountType?: string;
  isVatRegistered?: boolean;
  isRctRegistered?: boolean;
}

type TypeFilter = "all" | "income" | "expense" | "vat" | "rct";

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

interface RCTInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string | null;
  gross: number;
  rct_rate: number;
  rct_amount: number;
  net_receivable: number;
}

const ClientTransactions = ({
  clientUserId,
  accountantClientId,
  accountType,
  isVatRegistered = false,
  isRctRegistered = false,
}: ClientTransactionsProps) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  const [otherComment, setOtherComment] = useState("");
  const [otherDialogTarget, setOtherDialogTarget] = useState<TransactionRow[] | null>(null);
  const [vatApproveDialogOpen, setVatApproveDialogOpen] = useState(false);
  const [vatNotes, setVatNotes] = useState("");
  const { toast } = useToast();
  const upsertVATReturn = useAccountantUpsertVATReturn(clientUserId);
  const { data: vatReturns = [] } = useClientVATReturns(clientUserId);

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const txType = typeFilter === "all" || typeFilter === "vat" || typeFilter === "rct"
    ? undefined
    : typeFilter;
  const { data: rawTransactions = [], isLoading } = useClientTransactions(clientUserId, {
    type: txType,
    startDate,
    endDate,
    accountType,
  });
  const { data: categories = [] } = useClientCategories(clientUserId, undefined, accountType);
  const updateCategory = useUpdateTransactionCategory(clientUserId);
  const createDocRequest = useCreateDocumentRequest();
  const { data: receipts = [] } = useClientReceipts(clientUserId);
  const { data: invoices = [] } = useClientInvoices(clientUserId);

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

  // Build invoice lookup map by transaction_id
  const invoiceMap = useMemo(() => {
    const map = new Map<string, {
      invoice_number: string;
      customer_name: string | null;
      subtotal: number;
      vat_amount: number | null;
      total: number;
      rct_enabled: boolean;
      rct_rate: number;
      rct_amount: number;
      net_receivable: number;
      invoice_date: string;
    }>();
    for (const inv of invoices as Record<string, unknown>[]) {
      const txId = inv.transaction_id as string | null;
      if (txId) {
        const customer = inv.customer as Record<string, unknown> | null;
        const total = inv.total as number;
        const subtotal = inv.subtotal as number;
        const vatAmount = inv.vat_amount as number | null;

        // RCT data is stored in the notes JSON
        let rctEnabled = false;
        let rctRate = 0;
        let rctAmount = 0;
        try {
          const notes = inv.notes ? JSON.parse(inv.notes as string) : null;
          if (notes?.rct_enabled) {
            rctEnabled = true;
            rctRate = notes.rct_rate || 0;
            rctAmount = notes.rct_amount || 0;
          }
        } catch { /* plain text notes, no RCT */ }

        map.set(txId, {
          invoice_number: inv.invoice_number as string,
          customer_name: customer?.name as string | null ?? null,
          subtotal,
          vat_amount: vatAmount,
          total,
          rct_enabled: rctEnabled,
          rct_rate: rctRate,
          rct_amount: rctAmount,
          net_receivable: rctEnabled ? total - rctAmount : total,
          invoice_date: inv.invoice_date as string,
        });
      }
    }
    return map;
  }, [invoices]);

  // VAT subtotals from transactions
  const vatOnSalesTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Math.abs(t.vat_amount ?? 0), 0),
    [transactions],
  );
  const vatOnPurchasesTotal = useMemo(
    () =>
      transactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Math.abs(t.vat_amount ?? 0), 0),
    [transactions],
  );

  // RCT invoices from the invoice map
  const rctInvoices: RCTInvoiceRow[] = useMemo(() => {
    const rows: RCTInvoiceRow[] = [];
    for (const [txId, inv] of invoiceMap) {
      if (inv.rct_enabled) {
        rows.push({
          id: txId,
          invoice_number: inv.invoice_number,
          invoice_date: inv.invoice_date,
          customer_name: inv.customer_name,
          gross: inv.total,
          rct_rate: inv.rct_rate,
          rct_amount: inv.rct_amount,
          net_receivable: inv.net_receivable,
        });
      }
    }
    rows.sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
    return rows;
  }, [invoiceMap]);

  // VAT tab count = transactions with non-zero vat_amount
  const vatTabCount = useMemo(
    () => transactions.filter((t) => t.vat_amount != null && t.vat_amount !== 0).length,
    [transactions],
  );

  // Current period VAT return
  const currentPeriodReturn = useMemo(
    () =>
      (vatReturns as Record<string, unknown>[]).find(
        (r) => r.period_start === startDate && r.period_end === endDate,
      ),
    [vatReturns, startDate, endDate],
  );

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

  // For VAT tab, only show transactions with non-zero vat_amount
  const displayTransactions = useMemo(() => {
    if (typeFilter === "vat") {
      return groupedAndSorted.filter((t) => t.vat_amount != null && t.vat_amount !== 0);
    }
    return groupedAndSorted;
  }, [groupedAndSorted, typeFilter]);

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
    ...(isVatRegistered ? [{ key: "vat" as const, label: "VAT", count: vatTabCount }] : []),
    ...(isRctRegistered ? [{ key: "rct" as const, label: "RCT", count: rctInvoices.length }] : []),
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
    {
      id: "invoice",
      header: "Invoice",
      width: "w-14",
      align: "center",
      accessorFn: (row) => {
        const invoice = invoiceMap.get(row.id);
        if (!invoice) {
          return <span className="text-xs text-muted-foreground/40">{"\u2014"}</span>;
        }
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <FileText className="w-3.5 h-3.5 text-blue-500 mx-auto" />
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs space-y-0.5">
                  <p className="font-medium">{invoice.invoice_number}</p>
                  {invoice.customer_name && <p>{invoice.customer_name}</p>}
                  <p>Net: {formatCurrency(invoice.subtotal)}</p>
                  {invoice.rct_enabled ? (
                    <>
                      <p className="text-amber-500">RCT ({invoice.rct_rate}%): -{formatCurrency(invoice.rct_amount)}</p>
                      <p className="font-medium">Receivable: {formatCurrency(invoice.net_receivable)}</p>
                    </>
                  ) : (
                    <>
                      {invoice.vat_amount != null && invoice.vat_amount > 0 && (
                        <p>VAT: {formatCurrency(invoice.vat_amount)}</p>
                      )}
                      <p className="font-medium">Total: {formatCurrency(invoice.total)}</p>
                    </>
                  )}
                  <p className="text-muted-foreground">{invoice.invoice_date}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
  ];

  const rctColumns: ColumnDef<RCTInvoiceRow>[] = [
    {
      id: "invoice_number",
      header: "Invoice #",
      width: "w-28",
      accessorFn: (row) => (
        <span className="text-sm font-medium">{row.invoice_number}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      width: "w-24",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground tabular-nums">{row.invoice_date}</span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      width: "w-40",
      accessorFn: (row) => (
        <span className="text-sm truncate">{row.customer_name || "—"}</span>
      ),
    },
    {
      id: "gross",
      header: "Gross",
      width: "w-28",
      align: "right",
      accessorFn: (row) => (
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(row.gross)}</span>
      ),
    },
    {
      id: "rct_rate",
      header: "RCT Rate",
      width: "w-20",
      align: "center",
      accessorFn: (row) => (
        <span className="text-xs text-amber-600 font-medium">{row.rct_rate}%</span>
      ),
    },
    {
      id: "rct_amount",
      header: "RCT Deducted",
      width: "w-28",
      align: "right",
      accessorFn: (row) => (
        <span className="text-sm tabular-nums text-amber-600 font-medium">
          −{formatCurrency(row.rct_amount)}
        </span>
      ),
    },
    {
      id: "net_receivable",
      header: "Net Receivable",
      width: "w-28",
      align: "right",
      accessorFn: (row) => (
        <span className="text-sm font-semibold tabular-nums text-emerald-600">
          {formatCurrency(row.net_receivable)}
        </span>
      ),
    },
  ];

  const netVat = vatOnSalesTotal - vatOnPurchasesTotal;

  const handleApproveVAT = () => {
    upsertVATReturn.mutate(
      {
        period_start: startDate,
        period_end: endDate,
        vat_on_sales: vatOnSalesTotal,
        vat_on_purchases: vatOnPurchasesTotal,
        vat_due: netVat,
        vat_notes: vatNotes || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "VAT approved", description: `VAT return saved for ${taxYear}` });
          setVatApproveDialogOpen(false);
          setVatNotes("");
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to save VAT return", variant: "destructive" });
        },
      },
    );
  };

  // RCT totals
  const rctTotalGross = rctInvoices.reduce((s, r) => s + r.gross, 0);
  const rctTotalDeducted = rctInvoices.reduce((s, r) => s + r.rct_amount, 0);
  const rctTotalNet = rctInvoices.reduce((s, r) => s + r.net_receivable, 0);

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

      {/* Summary bar — conditional per tab */}
      {typeFilter === "vat" ? (
        <div className="flex items-center gap-6 rounded-lg border bg-card px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">VAT on Sales (T1)</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(vatOnSalesTotal)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">VAT on Purchases (T3)</span>
            <span className="font-semibold text-red-600">{formatCurrency(vatOnPurchasesTotal)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Net VAT</span>
            <span className={`font-semibold ${netVat >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(Math.abs(netVat))}
              <span className="text-xs text-muted-foreground ml-1">
                {netVat >= 0 ? "(payable)" : "(refund)"}
              </span>
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">{vatTabCount} transactions</span>
          </div>
          {currentPeriodReturn && (
            <>
              <div className="h-4 w-px bg-border" />
              <Badge variant="secondary" className="gap-1 text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
                Approved
              </Badge>
            </>
          )}
        </div>
      ) : typeFilter === "rct" ? (
        <div className="flex items-center gap-6 rounded-lg border bg-card px-4 py-2.5 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Total Gross</span>
            <span className="font-semibold text-foreground">{formatCurrency(rctTotalGross)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">RCT Deducted</span>
            <span className="font-semibold text-amber-600">−{formatCurrency(rctTotalDeducted)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Net Receivable</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(rctTotalNet)}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{rctInvoices.length}</span>
            <span className="text-muted-foreground">invoices</span>
          </div>
        </div>
      ) : (
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
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-semibold text-foreground">{invoiceMap.size}</span>
            <span className="text-muted-foreground">/ {incomeCount}</span>
          </div>
        </div>
      )}

      {/* Pipeline tabs */}
      <StatusPipelineTabs tabs={pipelineTabs} activeTab={typeFilter} onTabChange={handleTabChange} />

      {/* Action bar with bulk actions */}
      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={typeFilter === "rct" ? "Search invoices..." : "Search transactions..."}
        selectedCount={typeFilter === "rct" ? 0 : selectedCount}
        actions={
          typeFilter === "vat" ? (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => setVatApproveDialogOpen(true)}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve VAT
            </Button>
          ) : undefined
        }
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

      {/* Table — RCT uses separate columns/data, no row selection */}
      {typeFilter === "rct" ? (
        <DataTable
          columns={rctColumns}
          data={rctInvoices}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          emptyIcon={<Landmark className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage={`No RCT invoices found for ${taxYear}`}
        />
      ) : (
        <DataTable
          columns={columns}
          data={displayTransactions}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          emptyIcon={<Wallet className="w-10 h-10 text-muted-foreground/40" />}
          emptyMessage={`No transactions found for ${taxYear}`}
          selectable
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          isAllSelected={isAllSelected(displayTransactions.map((t) => t.id))}
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
      )}

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

      {/* VAT Approve dialog */}
      <Dialog open={vatApproveDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setVatApproveDialogOpen(false);
          setVatNotes("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve VAT Return</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">{startDate} to {endDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT on Sales (T1)</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(vatOnSalesTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT on Purchases (T3)</span>
                <span className="font-semibold text-red-600">{formatCurrency(vatOnPurchasesTotal)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net VAT</span>
                <span className={`font-semibold ${netVat >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {formatCurrency(Math.abs(netVat))} {netVat >= 0 ? "(payable)" : "(refund)"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-notes">Notes (optional)</Label>
              <Textarea
                id="vat-notes"
                placeholder="Any notes about this VAT return..."
                value={vatNotes}
                onChange={(e) => setVatNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setVatApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApproveVAT}
              disabled={upsertVATReturn.isPending}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {upsertVATReturn.isPending ? "Saving..." : "Approve & Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientTransactions;
