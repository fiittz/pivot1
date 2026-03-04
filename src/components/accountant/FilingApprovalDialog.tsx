import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface FilingApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filingType: string;
  clientName: string;
  taxPeriod: string;
  onApprove: (notes: string) => void;
  isApproving?: boolean;
}

export function FilingApprovalDialog({
  open,
  onOpenChange,
  filingType,
  clientName,
  taxPeriod,
  onApprove,
  isApproving,
}: FilingApprovalDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");

  const handleApprove = () => {
    if (!confirmed) return;
    onApprove(notes.trim());
  };

  const filingLabel = FILING_TYPE_LABELS[filingType] ?? filingType.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConfirmed(false); setNotes(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve Filing</DialogTitle>
          <DialogDescription>
            You are approving the {filingLabel} return for{" "}
            <strong>{clientName}</strong> covering the period{" "}
            <strong>{taxPeriod}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="approval-notes">Review Notes (optional)</Label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this filing..."
              rows={3}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
            <Checkbox
              id="confirm-approval"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="confirm-approval" className="text-sm text-foreground leading-relaxed cursor-pointer">
              I confirm that I have reviewed this filing and, to the best of my knowledge and belief,
              the information contained herein is true, correct, and complete. I understand that this
              return may be submitted to the Revenue Commissioners.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApprove}
            disabled={!confirmed || isApproving}
            className="border border-emerald-600 bg-emerald-600/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-emerald-600 hover:bg-emerald-600 hover:text-white"
          >
            {isApproving ? "Approving..." : "Approve Filing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FILING_TYPE_LABELS: Record<string, string> = {
  ct1: "CT1 — Corporation Tax",
  form11: "Form 11 — Income Tax",
  vat3: "VAT3 — VAT Return",
  rct_monthly: "RCT Monthly Return",
  b1: "B1 — Annual Return",
  annual_return: "Annual Return",
};
