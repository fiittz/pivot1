import { useState, useMemo } from "react";
import { CheckCircle2, Circle, ArrowUpDown, Loader2, Search, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AppLayout from "@/components/layout/AppLayout";
import { useReconciliation } from "@/hooks/useReconciliation";
import { toast } from "sonner";

type SortField = "date" | "amount" | "description";
type SortDir = "asc" | "desc";
type ViewTab = "unreconciled" | "reconciled" | "all";

export default function ReconciliationPage() {
  const {
    stats,
    unreconciledTransactions,
    reconciledTransactions,
    allTransactions,
    isLoading,
    markReconciled,
    markUnreconciled,
    isPending,
  } = useReconciliation();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewTab, setViewTab] = useState<ViewTab>("unreconciled");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [statementBalance, setStatementBalance] = useState("");

  const displayTransactions = useMemo(() => {
    let txns: Record<string, unknown>[];
    switch (viewTab) {
      case "unreconciled": txns = unreconciledTransactions; break;
      case "reconciled": txns = reconciledTransactions; break;
      default: txns = allTransactions as Record<string, unknown>[];
    }

    if (typeFilter !== "all") {
      txns = txns.filter((t) => t.type === typeFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      txns = txns.filter((t) => {
        const desc = String(t.description || "").toLowerCase();
        const cat = String((t.category as Record<string, unknown>)?.name || "").toLowerCase();
        return desc.includes(q) || cat.includes(q);
      });
    }

    txns = [...txns].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = String(a.transaction_date || "").localeCompare(String(b.transaction_date || "")); break;
        case "amount": cmp = Math.abs(Number(a.amount)) - Math.abs(Number(b.amount)); break;
        case "description": cmp = String(a.description || "").localeCompare(String(b.description || "")); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return txns;
  }, [viewTab, unreconciledTransactions, reconciledTransactions, allTransactions, search, sortField, sortDir, typeFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === displayTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayTransactions.map((t) => t.id as string)));
    }
  };

  const handleReconcile = async () => {
    const ids = Array.from(selectedIds);
    try {
      await markReconciled(ids);
      setSelectedIds(new Set());
      toast.success(`Reconciled ${ids.length} transaction${ids.length !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to reconcile transactions");
    }
  };

  const handleUnreconcile = async () => {
    const ids = Array.from(selectedIds);
    try {
      await markUnreconciled(ids);
      setSelectedIds(new Set());
      toast.success(`Unreconciled ${ids.length} transaction${ids.length !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to unreconcile transactions");
    }
  };

  const handleReconcileAll = async () => {
    const ids = unreconciledTransactions.map((t) => t.id as string);
    if (!ids.length) return;
    try {
      await markReconciled(ids);
      toast.success(`Reconciled all ${ids.length} transactions`);
    } catch {
      toast.error("Failed to reconcile all transactions");
    }
  };

  const balanceDifference = useMemo(() => {
    if (!statementBalance) return null;
    const stmtBal = parseFloat(statementBalance);
    if (isNaN(stmtBal)) return null;

    // Calculate running balance from transactions (income - expenses)
    const calculatedBalance = (allTransactions as Record<string, unknown>[]).reduce((bal, t) => {
      const amount = Number(t.amount) || 0;
      return t.type === "income" ? bal + amount : bal - amount;
    }, 0);

    return { statement: stmtBal, calculated: calculatedBalance, diff: stmtBal - calculatedBalance };
  }, [statementBalance, allTransactions]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto px-6 py-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Reconciliation</h2>
          {stats.unreconciled > 0 && (
            <Button size="sm" onClick={handleReconcileAll} disabled={isPending}>
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Reconcile All ({stats.unreconciled})
            </Button>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
              <p className="text-xs text-muted-foreground">transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Reconciled</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.reconciled}</p>
              <p className="text-xs text-muted-foreground">€{stats.reconciledAmount.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Unreconciled</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{stats.unreconciled}</p>
              <p className="text-xs text-muted-foreground">€{stats.unreconciledAmount.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Progress</p>
              <p className="text-2xl font-bold mt-1">{stats.reconciledPercent}%</p>
              <Progress value={stats.reconciledPercent} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Bank statement balance check */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Bank Statement Balance Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <label className="text-xs text-muted-foreground mb-1 block">Enter your bank statement closing balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={statementBalance}
                    onChange={(e) => setStatementBalance(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              {balanceDifference && (
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Calculated</p>
                    <p className="font-medium">€{balanceDifference.calculated.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Difference</p>
                    <p className={`font-bold ${Math.abs(balanceDifference.diff) < 0.01 ? "text-green-600" : "text-red-600"}`}>
                      €{balanceDifference.diff.toFixed(2)}
                    </p>
                  </div>
                  {Math.abs(balanceDifference.diff) < 0.01 && (
                    <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Balanced
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border overflow-hidden text-sm">
            {(["unreconciled", "reconciled", "all"] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => { setViewTab(tab); setSelectedIds(new Set()); }}
                className={`px-3 py-1.5 capitalize ${viewTab === tab ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              <SelectItem value="income" className="text-xs">Income</SelectItem>
              <SelectItem value="expense" className="text-xs">Expense</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">{displayTransactions.length} transactions</span>
        </div>

        {/* Selection bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <div className="flex-1" />
            {viewTab !== "reconciled" && (
              <Button size="sm" onClick={handleReconcile} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Mark Reconciled
              </Button>
            )}
            {viewTab !== "unreconciled" && (
              <Button size="sm" variant="outline" onClick={handleUnreconcile} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5" />}
                Mark Unreconciled
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}

        {/* Transaction table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={displayTransactions.length > 0 && selectedIds.size === displayTransactions.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="w-6 px-1 py-2" />
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => { setSortField("date"); setSortDir(sortField === "date" && sortDir === "desc" ? "asc" : "desc"); }}>
                  <span className="flex items-center gap-1">Date {sortField === "date" && <ArrowUpDown className="w-3 h-3" />}</span>
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => { setSortField("description"); setSortDir(sortField === "description" && sortDir === "asc" ? "desc" : "asc"); }}>
                  <span className="flex items-center gap-1">Description {sortField === "description" && <ArrowUpDown className="w-3 h-3" />}</span>
                </th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer" onClick={() => { setSortField("amount"); setSortDir(sortField === "amount" && sortDir === "desc" ? "asc" : "desc"); }}>
                  <span className="flex items-center justify-end gap-1">Amount {sortField === "amount" && <ArrowUpDown className="w-3 h-3" />}</span>
                </th>
                <th className="w-8 px-2 py-2 text-xs font-medium text-muted-foreground">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {displayTransactions.map((t) => {
                const id = t.id as string;
                const isSelected = selectedIds.has(id);
                const isRecon = t.is_reconciled === true;
                const amount = Number(t.amount) || 0;
                const catName = (t.category as Record<string, unknown>)?.name as string || "";

                return (
                  <tr
                    key={id}
                    className={`border-t border-border/50 hover:bg-muted/30 cursor-pointer ${isSelected ? "bg-primary/5" : ""}`}
                    onClick={() => toggleSelect(id)}
                  >
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(id)} />
                    </td>
                    <td className="px-1 py-2.5">
                      {isRecon ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                      {String(t.transaction_date || "")}
                    </td>
                    <td className="px-3 py-2.5 max-w-[300px] truncate">
                      {String(t.description || "")}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">
                      {catName || <span className="text-amber-500">Uncategorised</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${t.type === "income" ? "text-green-600" : ""}`}>
                      {t.type === "expense" ? "-" : ""}€{Math.abs(amount).toFixed(2)}
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      {t.receipt_url ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {displayTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    {viewTab === "unreconciled" ? "All transactions are reconciled!" : "No transactions found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
