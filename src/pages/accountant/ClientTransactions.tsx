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
  category: { id: string; name: string } | null;
  amount: number;
  category_id: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
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
    category: t.category as { id: string; name: string } | null,
    amount: Number(t.amount) || 0,
    category_id: t.category_id as string | null,
  }));

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
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
      id: "date",
      header: "Date",
      sortField: "transaction_date",
      width: "w-28",
      accessorFn: (row) => (
        <span className="text-xs text-muted-foreground">{row.transaction_date}</span>
      ),
    },
    {
      id: "description",
      header: "Description",
      sortField: "description",
      width: "min-w-[200px]",
      accessorFn: (row) => (
        <span className="text-sm text-foreground truncate block">
          {row.description || "No description"}
        </span>
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
            <SelectValue placeholder="Select..." />
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
      id: "amount",
      header: "Amount",
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
            {isIncome ? "+" : "-"}
            {formatCurrency(Math.abs(row.amount))}
          </span>
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
      <div className="grid grid-cols-2 gap-4">
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
