import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ArrowUpDown } from "lucide-react";
import { useCategories } from "@/hooks/useCategories";
import { useUpdateTransaction } from "@/hooks/useTransactions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TransactionStatusDot from "./TransactionStatusDot";
import TransactionEditDialog from "./TransactionEditDialog";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense" | string;
  transaction_date: string;
  vat_amount: number | null;
  is_reconciled: boolean | null;
  category_id: string | null;
  category?: { name: string } | null;
  account_id?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
}

const VAT_RATES = [
  { value: "0", label: "0% (Exempt)" },
  { value: "9", label: "9% (Reduced)" },
  { value: "13.5", label: "13.5% (2nd Reduced)" },
  { value: "23", label: "23% (Standard)" },
];

type SortKey = "date" | "description" | "category" | "amount";

interface Props {
  transactions: Transaction[];
  bankAccountType?: string;
}

export default function TransactionDataGrid({ transactions, bankAccountType }: Props) {
  const { data: categories } = useCategories(undefined, bankAccountType);
  const updateTransaction = useUpdateTransaction();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingVatId, setEditingVatId] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": cmp = a.transaction_date.localeCompare(b.transaction_date); break;
        case "description": cmp = a.description.localeCompare(b.description); break;
        case "category": cmp = (a.category?.name || "zzz").localeCompare(b.category?.name || "zzz"); break;
        case "amount": cmp = Math.abs(a.amount) - Math.abs(b.amount); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [transactions, sortKey, sortDir]);

  const handleCategoryChange = (txId: string, categoryId: string) => {
    updateTransaction.mutate({ id: txId, category_id: categoryId });
    setEditingCategoryId(null);
  };

  const handleVatChange = (txId: string, vatRate: string) => {
    const amount = transactions.find((t) => t.id === txId)?.amount ?? 0;
    const rate = parseFloat(vatRate) / 100;
    const vatAmount = Math.abs(amount) * rate / (1 + rate);
    updateTransaction.mutate({ id: txId, vat_amount: Math.round(vatAmount * 100) / 100 });
    setEditingVatId(null);
  };

  const SortHeader = ({ label, field, className }: { label: string; field: SortKey; className?: string }) => (
    <th className={`px-3 py-2.5 ${className || ""}`}>
      <button
        onClick={() => toggleSort(field)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === field ? "text-foreground" : ""}`} />
      </button>
    </th>
  );

  return (
    <>
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="w-8 px-3 py-2.5" />
                <SortHeader label="Date" field="date" className="text-left" />
                <SortHeader label="Description" field="description" className="text-left" />
                <SortHeader label="Category" field="category" className="text-left" />
                <th className="px-3 py-2.5 text-left">
                  <span className="text-xs font-medium text-muted-foreground">VAT</span>
                </th>
                <SortHeader label="Amount" field="amount" className="text-right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const isIncome = t.type === "income";
                return (
                  <tr
                    key={t.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                  >
                    {/* Status dot */}
                    <td className="px-3 py-2.5">
                      <TransactionStatusDot transaction={t} />
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                      {format(parseISO(t.transaction_date), "d MMM yy")}
                    </td>

                    {/* Description — click to edit full transaction */}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setEditingTransaction(t)}
                        className="text-left font-medium truncate max-w-[200px] hover:text-primary transition-colors block"
                      >
                        {t.description}
                      </button>
                    </td>

                    {/* Category — inline select */}
                    <td className="px-3 py-2.5">
                      {editingCategoryId === t.id ? (
                        <Select
                          value={t.category_id || ""}
                          onValueChange={(v) => handleCategoryChange(t.id, v)}
                          onOpenChange={(open) => { if (!open) setEditingCategoryId(null); }}
                          open
                        >
                          <SelectTrigger className="h-7 text-xs w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          onClick={() => setEditingCategoryId(t.id)}
                          className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                            t.category?.name
                              ? "bg-muted text-foreground hover:bg-muted/80"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {t.category?.name || "Uncategorized"}
                        </button>
                      )}
                    </td>

                    {/* VAT — inline select */}
                    <td className="px-3 py-2.5">
                      {editingVatId === t.id ? (
                        <Select
                          value={t.vat_amount ? String(Math.round((t.vat_amount / Math.abs(t.amount)) * 100)) : "0"}
                          onValueChange={(v) => handleVatChange(t.id, v)}
                          onOpenChange={(open) => { if (!open) setEditingVatId(null); }}
                          open
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATES.map((r) => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          onClick={() => setEditingVatId(t.id)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {t.vat_amount && t.vat_amount > 0 ? `€${t.vat_amount.toFixed(2)}` : "—"}
                        </button>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2.5 text-right">
                      <span className={`font-semibold tabular-nums ${isIncome ? "text-green-600" : ""}`}>
                        {isIncome ? "+" : "-"}€{Math.abs(t.amount).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransactionEditDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      />
    </>
  );
}
