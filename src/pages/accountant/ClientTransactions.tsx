import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/hooks/accountant/useClientData";
import { useUpdateTransactionCategory } from "@/hooks/accountant/useClientData";
import { useTableSort } from "@/hooks/useTableSort";
import { useTableSelection } from "@/hooks/useTableSelection";
import { ArrowUpRight, ArrowDownRight, Building2, User, Wallet } from "lucide-react";

interface ClientTransactionsProps {
  clientUserId: string | null | undefined;
  accountType?: string;
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

function formatVatRate(rate: number | null): string {
  if (rate == null) return "\u2014";
  return `${rate}%`;
}

const ClientTransactions = ({ clientUserId, accountType }: ClientTransactionsProps) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

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

  const { sortField, sortDir, onSort, sortData } = useTableSort<TransactionRow>();
  const { selectedIds, toggle, toggleAll, clear, isAllSelected, selectedCount } =
    useTableSelection();

  const sorted = sortData(filtered);

  const totalIncome = rawTransactions
    .filter((t: Record<string, unknown>) => t.type === "income")
    .reduce((sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalExpenses = rawTransactions
    .filter((t: Record<string, unknown>) => t.type === "expense")
    .reduce((sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalVat = rawTransactions
    .reduce((sum: number, t: Record<string, unknown>) => sum + Math.abs(Number(t.vat_amount) || 0), 0);

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

  const columns: ColumnDef<TransactionRow>[] = [
    {
      id: "type",
      header: "",
      width: "w-10",
      accessorFn: (row) => {
        const isIncome = row.type === "income";
        return (
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              isIncome ? "bg-emerald-500/10" : "bg-red-500/10"
            }`}
          >
            {isIncome ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-red-500" />
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: "w-24",
      accessorFn: (row) => {
        if (row.is_reconciled) {
          return (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500">
              Reconciled
            </Badge>
          );
        }
        if (!row.category_id) {
          return (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500">
              Review
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500">
            Categorised
          </Badge>
        );
      },
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
      id: "description",
      header: "Supplier / Description",
      sortField: "description",
      width: "min-w-[180px]",
      accessorFn: (row) => (
        <div className="min-w-0">
          <span className="text-sm text-foreground truncate block font-medium">
            {row.description || "No description"}
          </span>
          {row.reference && (
            <span className="text-[10px] text-muted-foreground truncate block">
              Ref: {row.reference}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      width: "w-40",
      accessorFn: (row) => (
        <Select
          value={row.category_id ?? "uncategorised"}
          onValueChange={(val) => {
            if (val !== "uncategorised") handleCategoryChange(row.id, val);
          }}
        >
          <SelectTrigger
            className="h-7 text-xs border-transparent bg-transparent hover:border-border transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
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
      ),
    },
    {
      id: "total",
      header: "Total",
      sortField: "amount",
      width: "w-24",
      align: "right",
      accessorFn: (row) => {
        const isIncome = row.type === "income";
        return (
          <span
            className={`text-sm font-semibold tabular-nums ${
              isIncome ? "text-emerald-600" : "text-foreground"
            }`}
          >
            {formatCurrency(Math.abs(row.amount))}
          </span>
        );
      },
    },
    {
      id: "tax",
      header: "Tax",
      sortField: "vat_amount",
      width: "w-20",
      align: "right",
      accessorFn: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.vat_amount != null ? formatCurrency(Math.abs(row.vat_amount)) : "\u2014"}
        </span>
      ),
    },
    {
      id: "tax_rate",
      header: "Tax Rate",
      width: "w-20",
      align: "right",
      accessorFn: (row) => {
        if (row.vat_rate == null) {
          return <span className="text-xs text-muted-foreground">{"\u2014"}</span>;
        }
        return (
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground font-mono"
          >
            {row.vat_rate}%
          </Badge>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Income ({taxYear})</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(totalIncome)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Expenses ({taxYear})</span>
            <span className="font-semibold text-red-600">{formatCurrency(totalExpenses)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">VAT ({taxYear})</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalVat)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline tabs */}
      <StatusPipelineTabs tabs={pipelineTabs} activeTab={typeFilter} onTabChange={handleTabChange} />

      {/* Action bar */}
      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search transactions..."
        selectedCount={selectedCount}
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={sorted}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        emptyIcon={<Wallet className="w-10 h-10 text-muted-foreground/40" />}
        emptyMessage={`No transactions found for ${taxYear}`}
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
  );
};

export default ClientTransactions;
