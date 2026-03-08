import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Send,
  Lock,
  FileDown,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  useDebtorCreditorPaper,
  useCreatePaper,
  useAddLine,
  useUpdateLine,
  useDeleteLine,
  useImportFromInvoices,
  useSendForConfirmation,
  useFinaliseAndPostJournal,
  getAgeBucket,
  type PaperType,
  type LineType,
  type DebtorCreditorLine,
  type PaperStatus,
} from "@/hooks/accountant/useDebtorCreditorPapers";

interface DebtorCreditorWorkingPaperProps {
  clientUserId: string;
  accountantClientId: string;
  taxYear: number;
  clientName?: string;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

type AgeBucket = "current" | "30-60" | "60-90" | "90+";

const BUCKET_CONFIG: Record<AgeBucket, { label: string; color: string; badgeClass: string }> = {
  current: {
    label: "Current (0-30)",
    color: "text-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  "30-60": {
    label: "30-60 days",
    color: "text-amber-600",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  "60-90": {
    label: "60-90 days",
    color: "text-orange-600",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
  },
  "90+": {
    label: "90+ days",
    color: "text-red-600",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
  },
};

const STATUS_CONFIG: Record<PaperStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
  sent_for_confirmation: { label: "Sent for Confirmation", className: "bg-blue-100 text-blue-700 border-blue-200" },
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-700 border-green-200" },
  finalised: { label: "Finalised", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
};

const CONFIRMATION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmed", className: "bg-green-100 text-green-700" },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700" },
  paid: { label: "Paid", className: "bg-blue-100 text-blue-700" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700" },
  unknown: { label: "Unknown", className: "bg-gray-100 text-gray-600" },
};

const DEBTOR_LINE_TYPES: { value: LineType; label: string }[] = [
  { value: "trade", label: "Trade Debtor" },
  { value: "accrued_income", label: "Accrued Income" },
  { value: "prepayment_received", label: "Prepayment Received" },
];

const CREDITOR_LINE_TYPES: { value: LineType; label: string }[] = [
  { value: "trade", label: "Trade Creditor" },
  { value: "accrual", label: "Accrual" },
  { value: "prepayment_made", label: "Prepayment Made" },
];

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  invoice: "Invoice",
  receipt: "Receipt",
  imported: "Imported",
};

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function DebtorCreditorWorkingPaper({
  clientUserId,
  accountantClientId,
  taxYear,
  clientName,
}: DebtorCreditorWorkingPaperProps) {
  const [paperType, setPaperType] = useState<PaperType>("debtors");
  const asAtDate = `${taxYear}-12-31`;

  const { data: paper, isLoading } = useDebtorCreditorPaper(clientUserId, taxYear, paperType);
  const createPaper = useCreatePaper();
  const addLine = useAddLine();
  const updateLine = useUpdateLine();
  const deleteLine = useDeleteLine();
  const importInvoices = useImportFromInvoices();
  const sendForConfirmation = useSendForConfirmation();
  const finalise = useFinaliseAndPostJournal();

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [finaliseOpen, setFinaliseOpen] = useState(false);

  const [form, setForm] = useState({
    counterparty_name: "",
    line_type: "trade" as LineType,
    reference: "",
    original_date: "",
    due_date: "",
    amount: "",
  });

  const resetForm = () => {
    setForm({
      counterparty_name: "",
      line_type: "trade",
      reference: "",
      original_date: "",
      due_date: "",
      amount: "",
    });
  };

  const isFinalised = paper?.status === "finalised";

  // Ensure the paper exists
  const handleEnsurePaper = async () => {
    if (paper) return paper;
    const result = await createPaper.mutateAsync({
      user_id: clientUserId,
      accountant_client_id: accountantClientId,
      tax_year: taxYear,
      paper_type: paperType,
      as_at_date: asAtDate,
    });
    return result;
  };

  const handleAddLine = async () => {
    let currentPaper = paper;
    if (!currentPaper) {
      const created = await handleEnsurePaper();
      currentPaper = { ...(created as unknown as { id: string }), lines: [] } as never;
    }

    addLine.mutate(
      {
        paper_id: (currentPaper as unknown as { id: string }).id,
        counterparty_name: form.counterparty_name,
        line_type: form.line_type,
        reference: form.reference || undefined,
        original_date: form.original_date || undefined,
        due_date: form.due_date || undefined,
        amount: parseFloat(form.amount),
        _clientUserId: clientUserId,
        _taxYear: taxYear,
        _paperType: paperType,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          resetForm();
        },
      },
    );
  };

  const handleImport = async () => {
    let currentPaper = paper;
    if (!currentPaper) {
      const created = await handleEnsurePaper();
      currentPaper = { ...(created as unknown as { id: string }), lines: [] } as never;
    }

    const existingSourceIds = (currentPaper?.lines ?? [])
      .filter((l) => l.source === "invoice" && l.source_id)
      .map((l) => l.source_id!);

    importInvoices.mutate({
      paper_id: (currentPaper as unknown as { id: string }).id,
      clientUserId,
      taxYear,
      paperType,
      existingSourceIds,
    });
  };

  const handleSendForConfirmation = () => {
    if (!paper) return;
    sendForConfirmation.mutate(
      {
        paper,
        accountantClientId,
        clientName: clientName ?? "Client",
      },
      { onSuccess: () => setConfirmSendOpen(false) },
    );
  };

  const handleFinalise = () => {
    if (!paper) return;
    finalise.mutate(
      { paper },
      { onSuccess: () => setFinaliseOpen(false) },
    );
  };

  // Grouped lines
  const lines = paper?.lines ?? [];
  const tradeLines = lines.filter((l) => l.line_type === "trade");
  const secondaryLines = lines.filter((l) =>
    paperType === "debtors"
      ? l.line_type === "accrued_income"
      : l.line_type === "accrual",
  );
  const tertiaryLines = lines.filter((l) =>
    paperType === "debtors"
      ? l.line_type === "prepayment_received"
      : l.line_type === "prepayment_made",
  );

  // Bucket totals for trade lines
  const bucketTotals = useMemo(() => {
    const totals: Record<AgeBucket, number> = { current: 0, "30-60": 0, "60-90": 0, "90+": 0 };
    for (const line of tradeLines) {
      const bucket = getAgeBucket(line.due_date, asAtDate);
      totals[bucket] += Number(line.amount);
    }
    return totals;
  }, [tradeLines, asAtDate]);

  const tradeTotal = tradeLines.reduce((s, l) => s + Number(l.amount), 0);
  const secondaryTotal = secondaryLines.reduce((s, l) => s + Number(l.amount), 0);
  const tertiaryTotal = tertiaryLines.reduce((s, l) => s + Number(l.amount), 0);

  // For send confirmation dialog summary
  const lineCountByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of lines) {
      counts[l.line_type] = (counts[l.line_type] ?? 0) + 1;
    }
    return counts;
  }, [lines]);

  // Build journal preview for finalise dialog
  const journalPreview = useMemo(() => {
    if (!paper) return [];
    const preview: Array<{ account: string; debit: number; credit: number }> = [];
    const aggregate: Record<string, { debit: number; credit: number }> = {};

    for (const line of paper.lines) {
      const amt = Number(line.amount);
      if (amt === 0) continue;

      let drAccount = "";
      let crAccount = "";

      if (paper.paper_type === "debtors") {
        switch (line.line_type) {
          case "trade":
            drAccount = "Trade Debtors";
            crAccount = "Suspense";
            break;
          case "accrued_income":
            drAccount = "Accrued Income";
            crAccount = "Suspense";
            break;
          case "prepayment_received":
            drAccount = "Suspense";
            crAccount = "Deferred Income";
            break;
        }
      } else {
        switch (line.line_type) {
          case "trade":
            drAccount = "Suspense";
            crAccount = "Trade Creditors";
            break;
          case "accrual":
            drAccount = "Suspense";
            crAccount = "Accruals";
            break;
          case "prepayment_made":
            drAccount = "Prepayments";
            crAccount = "Suspense";
            break;
        }
      }

      if (drAccount) {
        if (!aggregate[drAccount]) aggregate[drAccount] = { debit: 0, credit: 0 };
        aggregate[drAccount].debit += amt;
      }
      if (crAccount) {
        if (!aggregate[crAccount]) aggregate[crAccount] = { debit: 0, credit: 0 };
        aggregate[crAccount].credit += amt;
      }
    }

    for (const [account, vals] of Object.entries(aggregate)) {
      preview.push({ account, debit: vals.debit, credit: vals.credit });
    }

    return preview;
  }, [paper]);

  const lineTypeOptions = paperType === "debtors" ? DEBTOR_LINE_TYPES : CREDITOR_LINE_TYPES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading working paper...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Debtors &amp; Creditors Working Paper</h3>
          <p className="text-xs text-muted-foreground">
            {clientName ?? "Client"} &mdash; As at 31 Dec {taxYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {paper && (
            <Badge variant="outline" className={STATUS_CONFIG[paper.status].className}>
              {paper.status === "finalised" && <Lock className="w-3 h-3 mr-1" />}
              {STATUS_CONFIG[paper.status].label}
            </Badge>
          )}
        </div>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between">
        <ToggleGroup
          type="single"
          value={paperType}
          onValueChange={(v) => { if (v) setPaperType(v as PaperType); }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="debtors" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Debtors
          </ToggleGroupItem>
          <ToggleGroupItem value="creditors" className="gap-1.5 text-xs">
            <FileDown className="w-3.5 h-3.5" /> Creditors
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isFinalised && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => { resetForm(); setForm((f) => ({ ...f, line_type: lineTypeOptions[0].value })); setAddOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Line
            </Button>
          )}
          {paperType === "debtors" && !isFinalised && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleImport}
              disabled={importInvoices.isPending}
            >
              {importInvoices.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              Import from Invoices
            </Button>
          )}
          {paper && !isFinalised && (paper.status === "draft" || paper.status === "confirmed") && lines.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setConfirmSendOpen(true)}
            >
              <Send className="w-3.5 h-3.5" />
              Send for Confirmation
            </Button>
          )}
          {paper && !isFinalised && lines.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setFinaliseOpen(true)}
            >
              <Lock className="w-3.5 h-3.5" />
              Finalise &amp; Post Journal
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Trade */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {paperType === "debtors" ? "Trade Debtors" : "Trade Creditors"}
            </h4>
          </div>

          {/* Bucket summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3">
            {(Object.keys(BUCKET_CONFIG) as AgeBucket[]).map((bucket) => {
              const cfg = BUCKET_CONFIG[bucket];
              return (
                <Card key={bucket} className="border shadow-sm">
                  <CardContent className="py-3 px-4">
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    <p className={`text-lg font-semibold font-mono tabular-nums ${cfg.color}`}>
                      {eur(bucketTotals[bucket])}
                    </p>
                    {tradeTotal > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {((bucketTotals[bucket] / tradeTotal) * 100).toFixed(0)}% of total
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border shadow-sm">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold font-mono tabular-nums">
                  {eur(tradeTotal)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Trade lines table */}
          {tradeLines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Counterparty</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Ref</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Due Date</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Amount</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Age</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Source</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tradeLines.map((line) => (
                  <TradeLineRow
                    key={line.id}
                    line={line}
                    asAtDate={asAtDate}
                    isFinalised={isFinalised}
                    onDelete={() =>
                      deleteLine.mutate({
                        id: line.id,
                        _clientUserId: clientUserId,
                        _taxYear: taxYear,
                        _paperType: paperType,
                      })
                    }
                  />
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3" colSpan={4}>TOTAL</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(tradeTotal)}</td>
                  <td colSpan={4}></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No trade {paperType === "debtors" ? "debtors" : "creditors"} recorded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Secondary (Accrued Income / Accruals) */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {paperType === "debtors" ? "Accrued Income" : "Accruals"}
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {paperType === "debtors"
                ? "Recognised as Current Asset on Balance Sheet"
                : "Recognised as Current Liability on Balance Sheet"}
            </span>
          </div>

          {secondaryLines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Description</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Ref</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Amount</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {secondaryLines.map((line) => (
                  <SimpleLineRow
                    key={line.id}
                    line={line}
                    isFinalised={isFinalised}
                    onDelete={() =>
                      deleteLine.mutate({
                        id: line.id,
                        _clientUserId: clientUserId,
                        _taxYear: taxYear,
                        _paperType: paperType,
                      })
                    }
                  />
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(secondaryTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No {paperType === "debtors" ? "accrued income" : "accruals"} recorded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Tertiary (Prepayments Received / Prepayments Made) */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {paperType === "debtors" ? "Prepayments Received" : "Prepayments Made"}
            </h4>
            <span className="text-[10px] text-muted-foreground">
              {paperType === "debtors"
                ? "Recognised as Deferred Income (Current Liability) on Balance Sheet"
                : "Recognised as Prepayment (Current Asset) on Balance Sheet"}
            </span>
          </div>

          {tertiaryLines.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                    {paperType === "debtors" ? "Customer" : "Supplier"}
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Ref</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Amount</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {tertiaryLines.map((line) => (
                  <SimpleLineRow
                    key={line.id}
                    line={line}
                    isFinalised={isFinalised}
                    onDelete={() =>
                      deleteLine.mutate({
                        id: line.id,
                        _clientUserId: clientUserId,
                        _taxYear: taxYear,
                        _paperType: paperType,
                      })
                    }
                  />
                ))}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3" colSpan={2}>TOTAL</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(tertiaryTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No {paperType === "debtors" ? "prepayments received" : "prepayments made"} recorded.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Footer */}
      {lines.length > 0 && (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="px-3 py-2 bg-muted/30 border-b">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Balance Sheet Summary
              </h4>
            </div>
            <div className="p-4 space-y-2 text-sm">
              {paperType === "debtors" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trade Debtors</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Current Assets</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(tradeTotal)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Accrued Income</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Current Assets</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(secondaryTotal)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prepayments Received</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Deferred Income (Current Liabilities)</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(tertiaryTotal)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Trade Creditors</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Current Liabilities</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(tradeTotal)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Accruals</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Current Liabilities</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(secondaryTotal)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prepayments Made</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">Prepayments (Current Assets)</Badge>
                      <span className="font-mono tabular-nums font-medium w-24 text-right">{eur(tertiaryTotal)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Line Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Line
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Counterparty Name</Label>
              <Input
                value={form.counterparty_name}
                onChange={(e) => setForm({ ...form, counterparty_name: e.target.value })}
                placeholder={paperType === "debtors" ? "e.g. Acme Ltd" : "e.g. Office Supplies Co"}
                className="h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Line Type</Label>
                <Select
                  value={form.line_type}
                  onValueChange={(v) => setForm({ ...form, line_type: v as LineType })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {lineTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reference (optional)</Label>
                <Input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="e.g. INV-001"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  value={form.original_date}
                  onChange={(e) => setForm({ ...form, original_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date (optional)</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="h-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddLine}
              disabled={!form.counterparty_name || !form.amount || addLine.isPending || createPaper.isPending}
            >
              {addLine.isPending || createPaper.isPending ? "Adding..." : "Add Line"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send for Confirmation Dialog */}
      <Dialog open={confirmSendOpen} onOpenChange={setConfirmSendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-500" />
              Send for Confirmation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>
              This will send {lines.length} item{lines.length !== 1 ? "s" : ""} to{" "}
              <span className="font-medium">{clientName ?? "the client"}</span> for confirmation.
              They'll see each line on their dashboard and can confirm, mark as paid, or dispute.
            </p>
            <div className="rounded-lg border p-3 space-y-1 text-xs text-muted-foreground">
              {lineCountByType.trade && (
                <p>{lineCountByType.trade} trade {paperType === "debtors" ? "debtor" : "creditor"}{lineCountByType.trade !== 1 ? "s" : ""}</p>
              )}
              {lineCountByType.accrued_income && (
                <p>{lineCountByType.accrued_income} accrued income item{lineCountByType.accrued_income !== 1 ? "s" : ""}</p>
              )}
              {lineCountByType.prepayment_received && (
                <p>{lineCountByType.prepayment_received} prepayment{lineCountByType.prepayment_received !== 1 ? "s" : ""} received</p>
              )}
              {lineCountByType.accrual && (
                <p>{lineCountByType.accrual} accrual{lineCountByType.accrual !== 1 ? "s" : ""}</p>
              )}
              {lineCountByType.prepayment_made && (
                <p>{lineCountByType.prepayment_made} prepayment{lineCountByType.prepayment_made !== 1 ? "s" : ""} made</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConfirmSendOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendForConfirmation}
              disabled={sendForConfirmation.isPending}
            >
              {sendForConfirmation.isPending ? "Sending..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalise Dialog */}
      <Dialog open={finaliseOpen} onOpenChange={setFinaliseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              Finalise &amp; Post Journal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                This will post a journal entry recording these balances in the trial balance.
                The working paper will be locked.
              </p>
            </div>

            {/* Journal entry preview */}
            {journalPreview.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <div className="px-3 py-1.5 bg-muted/30 border-b">
                  <span className="text-xs font-medium text-muted-foreground">Journal Entry Preview</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/10">
                      <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Account</th>
                      <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Debit</th>
                      <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journalPreview.map((row) => (
                      <tr key={row.account} className="border-b border-muted/20">
                        <td className="py-1.5 px-3">{row.account}</td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {row.debit > 0 ? eur(row.debit) : ""}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {row.credit > 0 ? eur(row.credit) : ""}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-1.5 px-3">TOTALS</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                        {eur(journalPreview.reduce((s, r) => s + r.debit, 0))}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                        {eur(journalPreview.reduce((s, r) => s + r.credit, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFinaliseOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleFinalise}
              disabled={finalise.isPending}
            >
              {finalise.isPending ? "Posting..." : "Finalise & Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────

function TradeLineRow({
  line,
  asAtDate,
  isFinalised,
  onDelete,
}: {
  line: DebtorCreditorLine;
  asAtDate: string;
  isFinalised: boolean;
  onDelete: () => void;
}) {
  const bucket = getAgeBucket(line.due_date, asAtDate);
  const cfg = BUCKET_CONFIG[bucket];
  const hasConfirmationMismatch =
    line.confirmed_amount !== null &&
    line.confirmed_amount !== undefined &&
    Math.abs(Number(line.confirmed_amount) - Number(line.amount)) > 0.005;

  return (
    <tr
      className={`border-b border-muted/20 hover:bg-muted/10 transition-colors ${
        hasConfirmationMismatch ? "bg-amber-50" : ""
      }`}
    >
      <td className="py-1.5 px-3">
        <span className="text-sm">{line.counterparty_name}</span>
        {line.confirmation_note && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Client note: {line.confirmation_note}
          </p>
        )}
      </td>
      <td className="py-1.5 px-3 font-mono text-xs">{line.reference ?? "\u2014"}</td>
      <td className="py-1.5 px-3 text-xs text-muted-foreground">
        {line.original_date ? formatDate(line.original_date) : "\u2014"}
      </td>
      <td className="py-1.5 px-3 text-xs text-muted-foreground">
        {line.due_date ? formatDate(line.due_date) : "\u2014"}
      </td>
      <td className="py-1.5 px-3 text-right font-mono tabular-nums">
        {eur(Number(line.amount))}
        {hasConfirmationMismatch && (
          <div className="text-[10px] text-amber-600 mt-0.5">
            Confirmed: {eur(Number(line.confirmed_amount))}
          </div>
        )}
      </td>
      <td className="py-1.5 px-3 text-center">
        <Badge variant="outline" className={`text-[10px] ${cfg.badgeClass}`}>
          {cfg.label}
        </Badge>
      </td>
      <td className="py-1.5 px-3 text-center">
        <Badge variant="outline" className="text-[10px]">
          {SOURCE_LABELS[line.source] ?? line.source}
        </Badge>
      </td>
      <td className="py-1.5 px-3 text-center">
        {line.confirmation_status ? (
          <Badge
            variant="outline"
            className={`text-[10px] ${CONFIRMATION_STATUS_LABELS[line.confirmation_status]?.className ?? ""}`}
          >
            {CONFIRMATION_STATUS_LABELS[line.confirmation_status]?.label ?? line.confirmation_status}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">\u2014</span>
        )}
      </td>
      <td className="py-1.5 px-2">
        {!isFinalised && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onDelete}
            title="Delete line"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
          </Button>
        )}
      </td>
    </tr>
  );
}

function SimpleLineRow({
  line,
  isFinalised,
  onDelete,
}: {
  line: DebtorCreditorLine;
  isFinalised: boolean;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
      <td className="py-1.5 px-3">
        <span className="text-sm">{line.counterparty_name}</span>
      </td>
      <td className="py-1.5 px-3 font-mono text-xs">{line.reference ?? "\u2014"}</td>
      <td className="py-1.5 px-3 text-right font-mono tabular-nums">{eur(Number(line.amount))}</td>
      <td className="py-1.5 px-3 text-center">
        {line.confirmation_status ? (
          <Badge
            variant="outline"
            className={`text-[10px] ${CONFIRMATION_STATUS_LABELS[line.confirmation_status]?.className ?? ""}`}
          >
            {CONFIRMATION_STATUS_LABELS[line.confirmation_status]?.label ?? line.confirmation_status}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">\u2014</span>
        )}
      </td>
      <td className="py-1.5 px-2">
        {!isFinalised && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={onDelete}
            title="Delete line"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
          </Button>
        )}
      </td>
    </tr>
  );
}
