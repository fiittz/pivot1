import { useState, Fragment } from "react";
import { BookOpen, ChevronDown, ChevronRight, RotateCcw, Trash2, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useClientJournalEntries,
  useReverseJournalEntry,
  useDeleteJournalEntry,
  type JournalEntry,
  type JournalEntryType,
} from "@/hooks/accountant/useJournalEntries";
import { JournalEntryDialog } from "./JournalEntryDialog";

interface JournalEntriesListProps {
  clientUserId: string;
  taxYear: number;
  clientName?: string;
}

const ENTRY_TYPE_CONFIG: Record<JournalEntryType, { label: string; color: string }> = {
  adjustment: { label: "Adjustment", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  accrual: { label: "Accrual", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  depreciation: { label: "Depreciation", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  bad_debt: { label: "Bad Debt", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  correction: { label: "Correction", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  opening_balance: { label: "Opening Bal.", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  closing: { label: "Closing", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200" },
};

const eur = (n: number) =>
  n === 0
    ? "---"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

export function JournalEntriesList({
  clientUserId,
  taxYear,
  clientName,
}: JournalEntriesListProps) {
  const { data: entries, isLoading } = useClientJournalEntries(clientUserId, taxYear);
  const reverseMutation = useReverseJournalEntry();
  const deleteMutation = useDeleteJournalEntry();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confirmDelete, setConfirmDelete] = useState<JournalEntry | null>(null);
  const [confirmReverse, setConfirmReverse] = useState<JournalEntry | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEntryId((prev) => (prev === id ? null : id));
  };

  const filteredEntries = (entries ?? []).filter(
    (e) => typeFilter === "all" || e.entry_type === typeFilter,
  );

  const handleReverse = () => {
    if (!confirmReverse) return;
    reverseMutation.mutate(
      {
        journalEntry: confirmReverse,
        clientUserId,
        taxYear,
      },
      { onSuccess: () => setConfirmReverse(null) },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleteMutation.mutate(
      {
        journalEntryId: confirmDelete.id,
        clientUserId,
        taxYear,
      },
      { onSuccess: () => setConfirmDelete(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading journal entries...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Journal Entries
          </h3>
          <p className="text-xs text-muted-foreground">
            {clientName ?? "Client"} — {taxYear}
            {entries && entries.length > 0 && ` — ${entries.length} entries`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(ENTRY_TYPE_CONFIG).map(([value, cfg]) => (
                <SelectItem key={value} value={value}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> New Entry
          </Button>
        </div>
      </div>

      {/* No entries */}
      {filteredEntries.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {entries && entries.length > 0
              ? "No journal entries match the selected filter."
              : "No journal entries for this year. Create one to post adjustments."}
          </CardContent>
        </Card>
      )}

      {/* Entries table */}
      {filteredEntries.length > 0 && (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-8 py-2 px-2"></th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Ref</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Lines</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const isExpanded = expandedEntryId === entry.id;
                  const totalDebit = entry.lines.reduce(
                    (sum, l) => sum + (Number(l.debit) || 0),
                    0,
                  );
                  const typeCfg =
                    ENTRY_TYPE_CONFIG[entry.entry_type as JournalEntryType] ??
                    ENTRY_TYPE_CONFIG.adjustment;

                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className={`border-b border-muted/20 hover:bg-muted/10 cursor-pointer transition-colors ${
                          entry.is_reversed ? "opacity-50" : ""
                        }`}
                        onClick={() => toggleExpand(entry.id)}
                      >
                        <td className="py-1.5 px-2">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-xs whitespace-nowrap">
                          {entry.entry_date}
                        </td>
                        <td className="py-1.5 px-2 font-mono text-xs">{entry.reference}</td>
                        <td className="py-1.5 px-2 text-sm">
                          <div className="flex items-center gap-1.5">
                            {entry.description}
                            {entry.is_reversed && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 text-red-500 border-red-300">
                                REVERSED
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] h-5 ${typeCfg.color}`}
                          >
                            {typeCfg.label}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-xs tabular-nums">
                          {eur(totalDebit)}
                        </td>
                        <td className="py-1.5 px-2 text-center text-xs text-muted-foreground">
                          {entry.lines.length}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {!entry.is_reversed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title="Reverse this entry"
                                onClick={() => setConfirmReverse(entry)}
                              >
                                <RotateCcw className="w-3 h-3 text-muted-foreground hover:text-amber-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Delete this entry"
                              onClick={() => setConfirmDelete(entry)}
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded lines */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div className="bg-muted/20 px-6 py-2">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground">
                                    <th className="text-left py-1 font-medium">Account</th>
                                    <th className="text-left py-1 font-medium">Type</th>
                                    <th className="text-left py-1 font-medium">Code</th>
                                    <th className="text-right py-1 font-medium">Debit</th>
                                    <th className="text-right py-1 font-medium">Credit</th>
                                    <th className="text-left py-1 font-medium">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.lines.map((line) => (
                                    <tr key={line.id} className="border-t border-muted/20">
                                      <td className="py-1">{line.account_name}</td>
                                      <td className="py-1 text-muted-foreground">{line.account_type}</td>
                                      <td className="py-1 font-mono text-muted-foreground">
                                        {line.account_code ?? "---"}
                                      </td>
                                      <td className="py-1 text-right font-mono tabular-nums">
                                        {Number(line.debit) > 0 ? eur(Number(line.debit)) : ""}
                                      </td>
                                      <td className="py-1 text-right font-mono tabular-nums">
                                        {Number(line.credit) > 0 ? eur(Number(line.credit)) : ""}
                                      </td>
                                      <td className="py-1 text-muted-foreground">
                                        {line.description ?? ""}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {entry.notes && (
                                <p className="text-xs text-muted-foreground mt-2 italic">
                                  Notes: {entry.notes}
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <JournalEntryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        clientUserId={clientUserId}
        taxYear={taxYear}
      />

      {/* Confirm reverse dialog */}
      <AlertDialog open={!!confirmReverse} onOpenChange={() => setConfirmReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new reversing entry for{" "}
              <span className="font-medium">{confirmReverse?.reference}</span> that swaps all
              debits and credits. The original entry will be marked as reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReverse}
              disabled={reverseMutation.isPending}
            >
              {reverseMutation.isPending ? "Reversing..." : "Reverse"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete journal entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{confirmDelete?.reference}</span> and all its lines.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
