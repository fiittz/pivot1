import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Transaction {
  category_id: string | null;
  receipt_url?: string | null;
  is_reconciled?: boolean | null;
  notes?: string | null;
}

type Status = "processed" | "needs_review" | "flagged";

function getStatus(t: Transaction): Status {
  // Flagged by accountant
  if (t.notes?.includes("[FLAGGED]") || t.notes?.includes("[PENDING_BUSINESS_REVIEW]")) {
    return "flagged";
  }
  // Fully processed: categorized AND has receipt
  if (t.category_id && t.receipt_url) {
    return "processed";
  }
  // Needs review: uncategorized or missing receipt
  return "needs_review";
}

const STATUS_CONFIG: Record<Status, { color: string; label: string }> = {
  processed: { color: "bg-green-500", label: "Processed" },
  needs_review: { color: "bg-amber-500", label: "Needs review" },
  flagged: { color: "bg-red-500", label: "Flagged" },
};

interface Props {
  transaction: Transaction;
  size?: "sm" | "md";
}

export default function TransactionStatusDot({ transaction, size = "sm" }: Props) {
  const status = getStatus(transaction);
  const config = STATUS_CONFIG[status];
  const dotSize = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${dotSize} rounded-full ${config.color} flex-shrink-0 inline-block`} />
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {config.label}
      </TooltipContent>
    </Tooltip>
  );
}
