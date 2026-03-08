import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import TransactionDetailPane from "./TransactionDetailPane";
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

interface Props {
  transactions: Transaction[];
  bankAccountType?: string;
}

export default function SplitPaneView({ transactions, bankAccountType }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(transactions[0]?.id ?? null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const selectedTransaction = transactions.find((t) => t.id === selectedId) ?? null;

  return (
    <>
      <div className="bg-card rounded-xl border overflow-hidden" style={{ height: "calc(100vh - 280px)", minHeight: 400 }}>
        <ResizablePanelGroup direction="horizontal">
          {/* Left: Transaction list */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
            <div className="h-full overflow-y-auto">
              {transactions.map((t) => {
                const isSelected = t.id === selectedId;
                const isIncome = t.type === "income";
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                      isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <TransactionStatusDot transaction={t} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(t.transaction_date), "d MMM")}
                        {t.category?.name && (
                          <span className="ml-1.5 text-muted-foreground/70">· {t.category.name}</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${isIncome ? "text-green-600" : ""}`}>
                      {isIncome ? "+" : "-"}€{Math.abs(t.amount).toFixed(2)}
                    </span>
                  </button>
                );
              })}
              {transactions.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No transactions</div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Detail pane */}
          <ResizablePanel defaultSize={65}>
            <div className="h-full overflow-y-auto">
              <TransactionDetailPane
                transaction={selectedTransaction}
                bankAccountType={bankAccountType}
                onEdit={setEditingTransaction}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <TransactionEditDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(open) => !open && setEditingTransaction(null)}
      />
    </>
  );
}
