import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateJournalEntry,
  useNextJournalReference,
  type JournalEntryType,
  type JournalEntryLineInput,
} from "@/hooks/accountant/useJournalEntries";

interface JournalEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientUserId: string;
  taxYear: number;
}

const ENTRY_TYPES: { value: JournalEntryType; label: string }[] = [
  { value: "adjustment", label: "Adjustment" },
  { value: "accrual", label: "Accrual" },
  { value: "depreciation", label: "Depreciation" },
  { value: "bad_debt", label: "Bad Debt Write-off" },
  { value: "correction", label: "Correction" },
  { value: "opening_balance", label: "Opening Balance" },
  { value: "closing", label: "Closing Entry" },
];

const ACCOUNT_TYPES = ["Income", "Expense", "Asset", "Liability", "Equity"];

interface LineRow extends JournalEntryLineInput {
  _key: number;
}

const emptyLine = (key: number): LineRow => ({
  _key: key,
  account_name: "",
  account_type: "Expense",
  account_code: null,
  debit: 0,
  credit: 0,
  description: null,
});

// Common journal entry templates
const TEMPLATES: {
  label: string;
  entryType: JournalEntryType;
  description: string;
  lines: Omit<JournalEntryLineInput, "debit" | "credit">[];
}[] = [
  {
    label: "Accrual adjustment",
    entryType: "accrual",
    description: "Year-end accrual",
    lines: [
      { account_name: "Accrued Expenses", account_type: "Liability", description: "Accrual" },
      { account_name: "", account_type: "Expense", description: "Expense accrual" },
    ],
  },
  {
    label: "Depreciation charge",
    entryType: "depreciation",
    description: "Depreciation charge for the period",
    lines: [
      { account_name: "Depreciation Expense", account_type: "Expense", description: "Depreciation charge" },
      { account_name: "Accumulated Depreciation", account_type: "Asset", description: "Accumulated depreciation" },
    ],
  },
  {
    label: "Bad debt write-off",
    entryType: "bad_debt",
    description: "Write-off of irrecoverable debt",
    lines: [
      { account_name: "Bad Debts", account_type: "Expense", description: "Bad debt expense" },
      { account_name: "Trade Debtors", account_type: "Asset", description: "Write-off receivable" },
    ],
  },
];

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

export function JournalEntryDialog({
  open,
  onOpenChange,
  clientUserId,
  taxYear,
}: JournalEntryDialogProps) {
  const { data: nextRef } = useNextJournalReference(clientUserId, taxYear);
  const createMutation = useCreateJournalEntry();

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [entryType, setEntryType] = useState<JournalEntryType>("adjustment");
  const [notes, setNotes] = useState("");
  const [keyCounter, setKeyCounter] = useState(2);
  const [lines, setLines] = useState<LineRow[]>(() => [emptyLine(0), emptyLine(1)]);

  // Set reference from next ref query
  useEffect(() => {
    if (nextRef && !reference) {
      setReference(nextRef);
    }
  }, [nextRef, reference]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setEntryDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setReference(nextRef ?? "JE-001");
      setEntryType("adjustment");
      setNotes("");
      setLines([emptyLine(0), emptyLine(1)]);
      setKeyCounter(2);
    }
  }, [open, nextRef]);

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;
  const hasValidLines = lines.filter((l) => l.account_name.trim()).length >= 2;

  const addLine = useCallback(() => {
    setKeyCounter((prev) => {
      const nextKey = prev + 1;
      setLines((prevLines) => [...prevLines, emptyLine(nextKey)]);
      return nextKey;
    });
  }, []);

  const removeLine = useCallback((key: number) => {
    setLines((prev) => prev.filter((l) => l._key !== key));
  }, []);

  const updateLine = useCallback((key: number, field: keyof JournalEntryLineInput, value: string | number) => {
    setLines((prev) =>
      prev.map((l) => (l._key === key ? { ...l, [field]: value } : l)),
    );
  }, []);

  const applyTemplate = useCallback((templateIndex: number) => {
    const template = TEMPLATES[templateIndex];
    if (!template) return;

    setEntryType(template.entryType);
    setDescription(template.description);

    let counter = keyCounter;
    const newLines: LineRow[] = template.lines.map((tl) => {
      counter += 1;
      return {
        _key: counter,
        account_name: tl.account_name,
        account_type: tl.account_type,
        account_code: null,
        debit: 0,
        credit: 0,
        description: tl.description ?? null,
      };
    });
    setKeyCounter(counter);
    setLines(newLines);
  }, [keyCounter]);

  const handleSave = () => {
    const validLines = lines.filter((l) => l.account_name.trim());

    createMutation.mutate(
      {
        clientUserId,
        entryDate,
        description,
        reference,
        entryType,
        taxYear,
        notes: notes || null,
        lines: validLines.map(({ _key: _, ...rest }) => rest),
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            New Journal Entry
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="JE-001"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Type</Label>
              <Select value={entryType} onValueChange={(v) => setEntryType(v as JournalEntryType)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Year-end accrual for professional fees"
              className="h-8 text-sm"
            />
          </div>

          {/* Templates */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Templates:</span>
            {TEMPLATES.map((t, i) => (
              <Button
                key={t.label}
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => applyTemplate(i)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {/* Lines table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Account</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground w-28">Type</th>
                  <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground w-20">Code</th>
                  <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground w-28">Debit</th>
                  <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground w-28">Credit</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line._key} className="border-b border-muted/20">
                    <td className="py-1 px-1">
                      <Input
                        value={line.account_name}
                        onChange={(e) => updateLine(line._key, "account_name", e.target.value)}
                        placeholder="Account name"
                        className="h-7 text-xs border-0 shadow-none focus-visible:ring-1"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Select
                        value={line.account_type}
                        onValueChange={(v) => updateLine(line._key, "account_type", v)}
                      >
                        <SelectTrigger className="h-7 text-xs border-0 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACCOUNT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        value={line.account_code ?? ""}
                        onChange={(e) => updateLine(line._key, "account_code", e.target.value)}
                        placeholder="—"
                        className="h-7 text-xs font-mono border-0 shadow-none focus-visible:ring-1"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.debit || ""}
                        onChange={(e) => updateLine(line._key, "debit", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-7 text-xs text-right font-mono border-0 shadow-none focus-visible:ring-1"
                      />
                    </td>
                    <td className="py-1 px-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.credit || ""}
                        onChange={(e) => updateLine(line._key, "credit", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-7 text-xs text-right font-mono border-0 shadow-none focus-visible:ring-1"
                      />
                    </td>
                    <td className="py-1 px-1">
                      {lines.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => removeLine(line._key)}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2">
                  <td colSpan={3} className="py-1.5 px-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={addLine}
                    >
                      <Plus className="w-3 h-3" /> Add Line
                    </Button>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">
                    {eur(totalDebit)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">
                    {eur(totalCredit)}
                  </td>
                  <td></td>
                </tr>
                {!isBalanced && (
                  <tr>
                    <td colSpan={3} className="py-1 px-2 text-xs text-red-600">
                      Out of balance by {eur(Math.abs(totalDebit - totalCredit))}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes for this journal entry..."
              className="h-16 text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              !description.trim() ||
              !reference.trim() ||
              !isBalanced ||
              !hasValidLines ||
              totalDebit === 0 ||
              createMutation.isPending
            }
            className="gap-1"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {createMutation.isPending ? "Saving..." : "Post Journal Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
