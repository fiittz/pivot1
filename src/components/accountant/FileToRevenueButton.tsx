import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Clock, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFileReturn, useFilingExists, type ReturnType } from "@/hooks/accountant/useRevenueFiling";

interface FileToRevenueButtonProps {
  clientUserId: string;
  returnType: ReturnType;
  periodStart: string;
  periodEnd: string;
  taxYear: number;
  /** Function that generates the XML when called */
  generateXml: () => string;
  /** Summary data for the filing record */
  summary?: Record<string, unknown>;
  /** Additional label context */
  label?: string;
  disabled?: boolean;
}

const STATUS_STYLES: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  filed: { icon: CheckCircle2, color: "text-emerald-600", label: "Filed" },
  pending: { icon: Clock, color: "text-amber-600", label: "Pending" },
  submitting: { icon: Loader2, color: "text-blue-600", label: "Submitting" },
  rejected: { icon: AlertCircle, color: "text-red-600", label: "Rejected" },
  failed: { icon: AlertCircle, color: "text-red-600", label: "Failed" },
  draft: { icon: FileText, color: "text-muted-foreground", label: "Draft" },
};

export function FileToRevenueButton({
  clientUserId,
  returnType,
  periodStart,
  periodEnd,
  taxYear,
  generateXml,
  summary,
  label,
  disabled,
}: FileToRevenueButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: existingFiling } = useFilingExists(
    clientUserId,
    returnType,
    periodStart,
    periodEnd,
  );

  const fileReturn = useFileReturn();

  const handleFile = async () => {
    setShowConfirm(false);

    try {
      const xml = generateXml();
      await fileReturn.mutateAsync({
        clientUserId,
        returnType,
        periodStart,
        periodEnd,
        taxYear,
        returnXml: xml,
        summary,
      });
    } catch {
      // Error handled by mutation
    }
  };

  // Already filed
  if (existingFiling) {
    const style = STATUS_STYLES[existingFiling.status] ?? STATUS_STYLES.draft;
    const StatusIcon = style.icon;
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon className={`w-4 h-4 ${style.color} ${existingFiling.status === "submitting" ? "animate-spin" : ""}`} />
        <span className={style.color}>{style.label}</span>
        {existingFiling.filing_reference && (
          <span className="text-xs text-muted-foreground font-mono">
            Ref: {existingFiling.filing_reference}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || fileReturn.isPending}
        className="gap-2"
      >
        {fileReturn.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        File {label || returnType} to Revenue
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File {returnType} to Revenue?</DialogTitle>
            <DialogDescription>
              This will submit the {returnType} return for the period{" "}
              {periodStart} to {periodEnd} directly to Revenue via ROS.
              {"\n\n"}
              This action cannot be undone. Please ensure all figures have been reviewed.
            </DialogDescription>
          </DialogHeader>

          {summary && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              {Object.entries(summary).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-mono">
                    {typeof value === "number"
                      ? new Intl.NumberFormat("en-IE", {
                          style: "currency",
                          currency: "EUR",
                        }).format(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={handleFile} className="gap-2">
              <Send className="w-4 h-4" />
              Confirm &amp; File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
