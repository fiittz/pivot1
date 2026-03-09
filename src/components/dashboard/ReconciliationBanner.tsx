import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useMyReconciliationRequests,
  useRespondToReconciliationLine,
  useCompleteReconciliation,
  type ReconciliationRequest,
  type ReconciliationRequestLine,
} from "@/hooks/useMyReconciliationRequests";

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "disputed", label: "Disputed" },
  { value: "unknown", label: "Unknown" },
];

export function ReconciliationBanner() {
  const { data: requests = [] } = useMyReconciliationRequests();

  if (requests.length === 0) return null;

  const totalPending = requests.reduce(
    (sum, r) => sum + r.lines.filter((l) => !l.responded_at).length,
    0,
  );

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      {totalPending > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-4 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/50 shrink-0">
            <ClipboardCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {totalPending} item{totalPending !== 1 ? "s" : ""} awaiting your response
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Your accountant has sent reconciliation requests that need your confirmation.
            </p>
          </div>
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white rounded-full px-2.5 text-xs shrink-0">
            Review {totalPending} Item{totalPending !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {requests.map((request) => (
        <ReconciliationRequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}

function ReconciliationRequestCard({ request }: { request: ReconciliationRequest }) {
  const respond = useRespondToReconciliationLine();
  const complete = useCompleteReconciliation();

  // Local state for each line's form
  const [lineStates, setLineStates] = useState<
    Record<string, { status: string; confirmedAmount: string; note: string }>
  >(() => {
    const initial: Record<string, { status: string; confirmedAmount: string; note: string }> = {};
    for (const line of request.lines) {
      initial[line.id] = {
        status: line.client_status ?? "",
        confirmedAmount: line.confirmed_amount !== null ? String(line.confirmed_amount) : String(line.expected_amount),
        note: line.client_note ?? "",
      };
    }
    return initial;
  });

  const updateLineState = (lineId: string, field: string, value: string) => {
    setLineStates((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: value },
    }));
  };

  const handleSaveLine = (line: ReconciliationRequestLine) => {
    const state = lineStates[line.id];
    if (!state?.status) return;

    respond.mutate({
      lineId: line.id,
      confirmed_amount: state.status === "partial" ? parseFloat(state.confirmedAmount) || null : null,
      client_status: state.status,
      client_note: state.note || null,
    });
  };

  const allResponded = request.lines.every((l) => {
    const state = lineStates[l.id];
    return (state?.status && l.responded_at) || (state?.status && respond.isPending);
  });

  const respondedCount = request.lines.filter((l) => l.responded_at).length;

  const handleSubmitAll = () => {
    complete.mutate({ requestId: request.id });
  };

  return (
    <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
      <div className="px-4 py-3 bg-amber-50/50 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-800/30">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{request.title}</h3>
            {request.note && (
              <p className="text-xs text-muted-foreground mt-0.5">{request.note}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              As at {new Date(request.as_at_date).toLocaleDateString("en-IE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] rounded-full px-2 ${
              respondedCount === request.lines.length
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-amber-100 text-amber-700 border-amber-200"
            }`}
          >
            {respondedCount}/{request.lines.length} responded
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {request.lines.map((line) => {
          const state = lineStates[line.id] ?? { status: "", confirmedAmount: "", note: "" };
          const isResponded = !!line.responded_at;

          return (
            <div
              key={line.id}
              className={`space-y-2 rounded-xl border p-3 transition-colors ${
                isResponded
                  ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50"
                  : "bg-muted/10 border-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isResponded ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-sm font-medium">{line.label}</span>
                  {line.reference && (
                    <span className="text-xs font-mono text-muted-foreground">({line.reference})</span>
                  )}
                </div>
                <span className="text-sm font-mono font-medium tabular-nums">
                  {eur(Number(line.expected_amount))}
                </span>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Select
                    value={state.status}
                    onValueChange={(v) => updateLineState(line.id, "status", v)}
                    disabled={isResponded}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {state.status === "partial" && (
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      value={state.confirmedAmount}
                      onChange={(e) => updateLineState(line.id, "confirmedAmount", e.target.value)}
                      placeholder="Amount"
                      className="h-8 text-xs"
                      disabled={isResponded}
                    />
                  </div>
                )}

                <div className="flex-1">
                  <textarea
                    value={state.note}
                    onChange={(e) => updateLineState(line.id, "note", e.target.value)}
                    placeholder="Add a note..."
                    className="w-full text-xs rounded-md border bg-background px-2 py-1.5 resize-none h-8 focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isResponded}
                  />
                </div>

                {!isResponded && (
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    disabled={!state.status || respond.isPending}
                    onClick={() => handleSaveLine(line)}
                  >
                    <Send className="w-3 h-3" />
                    Save
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {respondedCount === request.lines.length && respondedCount > 0 && (
          <Button
            size="sm"
            className="w-full gap-1.5 bg-green-600 hover:bg-green-700"
            onClick={handleSubmitAll}
            disabled={complete.isPending}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {complete.isPending ? "Submitting..." : "Submit All Responses"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
