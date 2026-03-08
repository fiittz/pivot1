import { Fragment, useState } from "react";
import { Flag, MessageSquare, CheckCircle2, AlertTriangle, HelpCircle, Loader2, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useClientTrialBalance,
  useTrialBalanceFlags,
  useCreateTBFlag,
  useResolveTBFlag,
  type TrialBalanceLine,
  type TBFlag,
} from "@/hooks/accountant/useTrialBalance";
import { ETBExportButton } from "@/components/accountant/ETBExportButton";
import { useAccountSelector } from "@/hooks/accountant/useAccountSelector";
import { AccountSelectorDropdown } from "@/components/accountant/AccountSelectorDropdown";

interface TrialBalanceViewProps {
  clientUserId: string;
  accountantClientId: string;
  taxYear: number;
  clientName?: string;
  onDrillDown?: (accountName: string) => void;
}

const eur = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const TYPE_COLORS: Record<string, string> = {
  Income: "text-emerald-600",
  "Cost of Sales": "text-orange-600",
  Expense: "text-red-500",
  Payroll: "text-red-400",
  "Fixed Assets": "text-blue-600",
  "Current Assets": "text-blue-500",
  VAT: "text-purple-500",
  "Current Liabilities": "text-amber-600",
  Equity: "text-indigo-600",
  bank: "text-gray-500",
};

const FLAG_TYPE_CONFIG = {
  query: { icon: HelpCircle, label: "Query", color: "text-blue-500" },
  warning: { icon: AlertTriangle, label: "Warning", color: "text-amber-500" },
  adjustment_needed: { icon: Flag, label: "Adjustment", color: "text-red-500" },
};

export function TrialBalanceView({
  clientUserId,
  accountantClientId,
  taxYear,
  clientName,
  onDrillDown,
}: TrialBalanceViewProps) {
  const { selections, selectedAccountIds, toggleAccount, selectAll, deselectAll, hasAccounts } =
    useAccountSelector(clientUserId);
  const { data: tb, isLoading } = useClientTrialBalance(
    clientUserId,
    taxYear,
    hasAccounts ? selectedAccountIds : undefined,
  );
  const { data: flags = [] } = useTrialBalanceFlags(accountantClientId, taxYear);
  const createFlag = useCreateTBFlag();
  const resolveFlag = useResolveTBFlag();

  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [selectedLine, setSelectedLine] = useState<TrialBalanceLine | null>(null);
  const [flagNote, setFlagNote] = useState("");
  const [flagType, setFlagType] = useState<"query" | "warning" | "adjustment_needed">("query");
  const [sendToClient, setSendToClient] = useState(true);

  const openFlagDialog = (line: TrialBalanceLine) => {
    setSelectedLine(line);
    setFlagNote("");
    setFlagType("query");
    setSendToClient(true);
    setFlagDialogOpen(true);
  };

  const handleCreateFlag = () => {
    if (!selectedLine || !flagNote.trim()) return;

    createFlag.mutate(
      {
        accountantClientId,
        clientUserId,
        taxYear,
        accountName: selectedLine.accountName,
        accountType: selectedLine.accountType,
        flaggedAmount: selectedLine.debit || selectedLine.credit,
        flagType,
        note: flagNote,
        createDocRequest: sendToClient,
      },
      { onSuccess: () => setFlagDialogOpen(false) },
    );
  };

  // Group flags by account name for quick lookup
  const flagsByAccount = new Map<string, TBFlag[]>();
  for (const flag of flags) {
    const key = flag.account_name;
    if (!flagsByAccount.has(key)) flagsByAccount.set(key, []);
    flagsByAccount.get(key)!.push(flag);
  }

  const openFlags = flags.filter((f) => f.status === "open");
  const respondedFlags = flags.filter((f) => f.status === "responded");

  // Group lines by account type for section headers
  let lastType = "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Computing trial balance...</span>
      </div>
    );
  }

  if (!tb || tb.lines.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions found for {taxYear}. Import bank data first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Trial Balance</h3>
          <p className="text-xs text-muted-foreground">
            {clientName ?? "Client"} — Year ended 31 Dec {taxYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openFlags.length > 0 && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              {openFlags.length} open {openFlags.length === 1 ? "query" : "queries"}
            </Badge>
          )}
          {respondedFlags.length > 0 && (
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              {respondedFlags.length} responded
            </Badge>
          )}
          <Badge
            variant="outline"
            className={tb.isBalanced ? "text-emerald-600 border-emerald-300" : "text-red-600 border-red-300"}
          >
            {tb.isBalanced ? "Balanced" : `Difference: ${eur(tb.difference)}`}
          </Badge>
          {hasAccounts && (
            <AccountSelectorDropdown
              selections={selections}
              onToggle={toggleAccount}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
            />
          )}
          <ETBExportButton clientUserId={clientUserId} taxYear={taxYear} clientName={clientName} />
        </div>
      </div>

      {/* Responded flags alert */}
      {respondedFlags.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="py-3 space-y-2">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
              Client responded to {respondedFlags.length} {respondedFlags.length === 1 ? "query" : "queries"}
            </p>
            {respondedFlags.map((flag) => (
              <div key={flag.id} className="flex items-start justify-between gap-2 text-xs">
                <div className="flex-1">
                  <span className="font-medium">{flag.account_name}:</span>{" "}
                  <span className="text-muted-foreground">{flag.client_response}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1 text-emerald-600"
                  onClick={() =>
                    resolveFlag.mutate({
                      flagId: flag.id,
                      accountantClientId,
                      taxYear,
                    })
                  }
                >
                  <CheckCircle2 className="w-3 h-3" /> Resolve
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Trial Balance Table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Code</th>
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Account</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Debit</th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Credit</th>
                <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground w-8">Txns</th>
                <th className="py-2 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {tb.lines.map((line, idx) => {
                const showHeader = line.accountType !== lastType;
                lastType = line.accountType;
                const lineFlags = flagsByAccount.get(line.accountName) ?? [];
                const hasOpenFlag = lineFlags.some((f) => f.status === "open");
                const hasRespondedFlag = lineFlags.some((f) => f.status === "responded");

                return (
                  <Fragment key={idx}>
                    {showHeader && (
                      <tr>
                        <td colSpan={6} className="pt-3 pb-1 px-3">
                          <span className={`text-xs font-semibold uppercase tracking-wider ${TYPE_COLORS[line.accountType] ?? "text-gray-500"}`}>
                            {line.accountType}
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b border-muted/20 hover:bg-muted/10 transition-colors cursor-pointer group ${
                        hasOpenFlag ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                      } ${hasRespondedFlag ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}`}
                      onClick={() => onDrillDown?.(line.accountName)}
                    >
                      <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">
                        {line.accountCode ?? "—"}
                      </td>
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm group-hover:text-primary transition-colors">{line.accountName}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          {lineFlags.map((f) => {
                            const cfg = FLAG_TYPE_CONFIG[f.flag_type as keyof typeof FLAG_TYPE_CONFIG];
                            const Icon = cfg?.icon ?? Flag;
                            return (
                              <span key={f.id} title={f.note} className={cfg?.color ?? "text-gray-500"}>
                                <Icon className="w-3 h-3" />
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-sm tabular-nums">
                        {line.debit > 0 ? eur(line.debit) : ""}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-sm tabular-nums">
                        {line.credit > 0 ? eur(line.credit) : ""}
                      </td>
                      <td className="py-1.5 px-3 text-center text-xs text-muted-foreground">
                        {line.transactionCount}
                      </td>
                      <td className="py-1.5 px-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => { e.stopPropagation(); openFlagDialog(line); }}
                          title="Flag this line"
                        >
                          <Flag className="w-3 h-3 text-muted-foreground hover:text-amber-500" />
                        </Button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}

              {/* Totals */}
              <tr className="border-t-2 font-semibold">
                <td className="py-2 px-3"></td>
                <td className="py-2 px-3">TOTALS</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(tb.totalDebit)}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(tb.totalCredit)}</td>
                <td></td>
                <td></td>
              </tr>
              {!tb.isBalanced && (
                <tr className="text-red-600">
                  <td className="py-1 px-3"></td>
                  <td className="py-1 px-3 text-xs">DIFFERENCE</td>
                  <td colSpan={2} className="py-1 px-3 text-right font-mono text-xs">
                    {eur(tb.difference)}
                  </td>
                  <td></td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Flag Dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-500" />
              Flag: {selectedLine?.accountName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Balance:</span>
              <span className="font-mono font-medium">
                {selectedLine?.debit ? `Dr ${eur(selectedLine.debit)}` : `Cr ${eur(selectedLine?.credit ?? 0)}`}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Flag Type</Label>
              <Select value={flagType} onValueChange={(v) => setFlagType(v as typeof flagType)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="query">Query — request info</SelectItem>
                  <SelectItem value="warning">Warning — potential issue</SelectItem>
                  <SelectItem value="adjustment_needed">Adjustment needed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Note / Question</Label>
              <textarea
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                placeholder="e.g. This entertainment figure seems high — can you confirm this includes only staff events?"
                className="w-full h-20 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendToClient}
                onChange={(e) => setSendToClient(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">
                Send as info request to client (they'll see it in their dashboard)
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFlagDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateFlag}
              disabled={!flagNote.trim() || createFlag.isPending}
              className="gap-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {createFlag.isPending ? "Sending..." : sendToClient ? "Flag & Request Info" : "Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

