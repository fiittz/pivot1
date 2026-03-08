import { format, parseISO } from "date-fns";
import { ArrowUpRight, ArrowDownLeft, Brain, Camera, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReceiptUrl } from "@/hooks/useReceiptUrl";
import InlineCategoryPicker from "./InlineCategoryPicker";
import TransactionStatusDot from "./TransactionStatusDot";
import { useState } from "react";

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
  transaction: Transaction | null;
  bankAccountType?: string;
  onEdit?: (transaction: Transaction) => void;
}

export default function TransactionDetailPane({ transaction, bankAccountType, onEdit }: Props) {
  const receiptUrl = useReceiptUrl(transaction?.receipt_url ?? null);
  const [categorizingOpen, setCategorizingOpen] = useState(false);

  if (!transaction) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-20">
        <div className="text-center space-y-2">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <p>Select a transaction to view details</p>
        </div>
      </div>
    );
  }

  const isIncome = transaction.type === "income";
  const isAiSuggested = !!(transaction.notes?.includes("[Auto-matched]") || transaction.notes?.includes("[AI]"));

  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isIncome ? "bg-green-100 dark:bg-green-950/40" : "bg-red-100 dark:bg-red-950/40"}`}>
          {isIncome ? <ArrowDownLeft className="w-5 h-5 text-green-600" /> : <ArrowUpRight className="w-5 h-5 text-red-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <TransactionStatusDot transaction={transaction} size="md" />
            <h3 className="font-semibold text-lg truncate">{transaction.description}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(transaction.transaction_date), "EEEE, d MMMM yyyy")}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Amount</p>
        <p className={`text-3xl font-bold ${isIncome ? "text-green-600" : ""}`}>
          {isIncome ? "+" : "-"}€{Math.abs(transaction.amount).toFixed(2)}
        </p>
        {!!transaction.vat_amount && transaction.vat_amount > 0 && (
          <p className="text-sm text-muted-foreground mt-1">
            VAT: €{transaction.vat_amount.toFixed(2)}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Category</p>
        <InlineCategoryPicker
          transactionId={transaction.id}
          currentCategory={transaction.category}
          currentCategoryId={transaction.category_id}
          transactionDescription={transaction.description}
          currentVatRate={transaction.vat_amount}
          isAiSuggested={isAiSuggested}
          isOpen={categorizingOpen}
          onOpenChange={setCategorizingOpen}
          bankAccountType={bankAccountType}
        />
        {isAiSuggested && (
          <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
            <Brain className="w-3 h-3" /> AI-suggested — click to change
          </p>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {transaction.is_reconciled ? (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Matched
          </span>
        ) : (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
            Unmatched
          </span>
        )}
        {transaction.receipt_url && (
          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5" /> Receipt attached
          </span>
        )}
      </div>

      {/* Receipt Image */}
      {receiptUrl && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Receipt</p>
          <img src={receiptUrl} alt="Receipt" className="w-full max-h-64 object-contain rounded-lg border" />
        </div>
      )}

      {/* Notes */}
      {transaction.notes && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm bg-muted/50 rounded-lg p-3">{transaction.notes}</p>
        </div>
      )}

      {/* Edit button */}
      {onEdit && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => onEdit(transaction)}>
          Edit Transaction
        </Button>
      )}
    </div>
  );
}
