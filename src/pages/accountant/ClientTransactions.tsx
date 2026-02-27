import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useClientTransactions } from "@/hooks/accountant/useClientData";
import { Search, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface ClientTransactionsProps {
  clientUserId: string | null | undefined;
}

const ClientTransactions = ({ clientUserId }: ClientTransactionsProps) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const { data: transactions = [], isLoading } = useClientTransactions(clientUserId, {
    type: typeFilter === "all" ? undefined : typeFilter,
    startDate,
    endDate,
  });

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        (t.description ?? "").toLowerCase().includes(q) ||
        ((t.category as { name: string } | null)?.name ?? "").toLowerCase().includes(q),
    );
  }, [transactions, search]);

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="pl-9 h-9 bg-transparent"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {t === "all" ? "All" : t === "income" ? "Income" : "Expenses"}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading transactions...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No transactions found for {taxYear}.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((t) => {
                const isIncome = t.type === "income";
                const catName = (t.category as { name: string } | null)?.name;
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isIncome ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {isIncome ? (
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {t.description || "No description"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {t.transaction_date}
                        </span>
                        {catName && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {catName}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums ${
                      isIncome ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {isIncome ? "+" : "-"}{formatCurrency(Math.abs(Number(t.amount) || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientTransactions;
