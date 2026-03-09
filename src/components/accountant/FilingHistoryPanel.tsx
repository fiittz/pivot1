import { CheckCircle2, AlertCircle, Clock, Loader2, FileText, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientFilings, useCheckFilingStatus, type RevenueFiling } from "@/hooks/accountant/useRevenueFiling";

interface FilingHistoryPanelProps {
  clientUserId: string;
  taxYear: number;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  filed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  submitting: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50" },
  rejected: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  failed: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  draft: { icon: FileText, color: "text-muted-foreground", bg: "bg-muted/30" },
};

const RETURN_LABELS: Record<string, string> = {
  VAT3: "VAT3 Return",
  CT1: "CT1 Corporation Tax",
  Form11: "Form 11 Income Tax",
  RCT: "RCT Monthly Return",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FilingHistoryPanel({ clientUserId, taxYear }: FilingHistoryPanelProps) {
  const { data: filings, isLoading } = useClientFilings(clientUserId, taxYear);
  const checkStatus = useCheckFilingStatus();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading filing history...
      </div>
    );
  }

  if (!filings || filings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No returns filed for {taxYear}. Use the File to Revenue button on each return to submit.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filings.map((filing) => (
        <FilingRow
          key={filing.id}
          filing={filing}
          onCheckStatus={() =>
            checkStatus.mutate({ filingId: filing.id, clientUserId })
          }
          isChecking={checkStatus.isPending}
        />
      ))}
    </div>
  );
}

function FilingRow({
  filing,
  onCheckStatus,
  isChecking,
}: {
  filing: RevenueFiling;
  onCheckStatus: () => void;
  isChecking: boolean;
}) {
  const config = STATUS_CONFIG[filing.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = config.icon;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <StatusIcon
                className={`w-4 h-4 ${config.color} ${filing.status === "submitting" ? "animate-spin" : ""}`}
              />
            </div>
            <div>
              <p className="font-medium text-sm">
                {RETURN_LABELS[filing.return_type] ?? filing.return_type}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Period: {filing.period_start} to {filing.period_end}
              </p>
              {filing.filing_reference && (
                <p className="text-xs font-mono text-muted-foreground mt-0.5">
                  Ref: {filing.filing_reference}
                </p>
              )}
              {filing.error_message && (
                <p className="text-xs text-red-600 mt-1">
                  {filing.error_message}
                </p>
              )}
              {filing.test_mode && (
                <span className="inline-block mt-1 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  TEST MODE
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className={`text-sm font-medium ${config.color}`}>
              {filing.status.charAt(0).toUpperCase() + filing.status.slice(1)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {filing.submitted_at ? formatDate(filing.submitted_at) : formatDate(filing.created_at)}
            </p>

            {(filing.status === "pending" || filing.status === "submitting") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onCheckStatus}
                disabled={isChecking}
                className="mt-1 h-7 text-xs gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
                Check Status
              </Button>
            )}
          </div>
        </div>

        {/* Summary data */}
        {filing.summary_data && Object.keys(filing.summary_data).length > 0 && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(filing.summary_data).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-sm font-mono">
                  {typeof value === "number"
                    ? new Intl.NumberFormat("en-IE", {
                        style: "currency",
                        currency: "EUR",
                      }).format(value)
                    : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
