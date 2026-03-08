import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientInvoices } from "@/hooks/accountant/useClientData";

interface AgedDebtorsViewProps {
  clientUserId: string;
  clientName?: string;
}

const eur = (n: number) =>
  n === 0
    ? "—"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

type AgeBucket = "current" | "30-60" | "60-90" | "90+";

const BUCKET_CONFIG: Record<
  AgeBucket,
  { label: string; color: string; badgeClass: string }
> = {
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

function getBucket(daysOverdue: number): AgeBucket {
  if (daysOverdue <= 30) return "current";
  if (daysOverdue <= 60) return "30-60";
  if (daysOverdue <= 90) return "60-90";
  return "90+";
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

interface DebtorLine {
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  bucket: AgeBucket;
}

export function AgedDebtorsView({
  clientUserId,
  clientName,
}: AgedDebtorsViewProps) {
  const { data: invoices, isLoading } = useClientInvoices(clientUserId);

  const { lines, bucketTotals, totalOutstanding } = useMemo(() => {
    const today = new Date();
    const allLines: DebtorLine[] = [];
    const totals: Record<AgeBucket, number> = {
      current: 0,
      "30-60": 0,
      "60-90": 0,
      "90+": 0,
    };

    for (const inv of invoices ?? []) {
      const i = inv as Record<string, unknown>;
      const status = (i.status as string) ?? "";

      // Only include unpaid invoices
      if (status === "paid" || status === "cancelled" || status === "draft") {
        continue;
      }

      const invoiceDate = i.invoice_date as string;
      const dueDate = (i.due_date as string) ?? invoiceDate;
      const amount = Math.abs(Number(i.total_amount ?? i.amount) || 0);
      if (amount === 0) continue;

      const dueDateObj = new Date(dueDate);
      const daysOverdue = Math.max(0, daysBetween(dueDateObj, today));
      const bucket = getBucket(daysOverdue);

      const customer = i.customer as Record<string, unknown> | null;
      const customerName = (customer?.name as string) ?? "Unknown Customer";
      const invoiceNumber =
        (i.invoice_number as string) ?? (i.id as string)?.slice(0, 8) ?? "—";

      allLines.push({
        customerName,
        invoiceNumber,
        invoiceDate,
        dueDate,
        amount,
        daysOverdue,
        bucket,
      });

      totals[bucket] += amount;
    }

    // Sort by days overdue descending (most overdue first)
    allLines.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const total = Object.values(totals).reduce((s, v) => s + v, 0);

    return { lines: allLines, bucketTotals: totals, totalOutstanding: total };
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading aged debtors...
        </span>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No outstanding invoices found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-lg">Aged Debtors Report</h3>
        <p className="text-xs text-muted-foreground">
          {clientName ?? "Client"} — As at{" "}
          {new Date().toLocaleDateString("en-IE", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Summary buckets */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(BUCKET_CONFIG) as AgeBucket[]).map((bucket) => {
          const cfg = BUCKET_CONFIG[bucket];
          return (
            <Card key={bucket} className="border shadow-sm">
              <CardContent className="py-3 px-4">
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={`text-lg font-semibold font-mono tabular-nums ${cfg.color}`}>
                  {eur(bucketTotals[bucket])}
                </p>
                {totalOutstanding > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {((bucketTotals[bucket] / totalOutstanding) * 100).toFixed(0)}% of total
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        <Card className="border shadow-sm">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-lg font-bold font-mono tabular-nums">
              {eur(totalOutstanding)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                  Customer
                </th>
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                  Invoice #
                </th>
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                  Date
                </th>
                <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">
                  Due Date
                </th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                  Amount
                </th>
                <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">
                  Days
                </th>
                <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">
                  Age
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const cfg = BUCKET_CONFIG[line.bucket];
                return (
                  <tr
                    key={idx}
                    className="border-b border-muted/20 hover:bg-muted/10 transition-colors"
                  >
                    <td className="py-1.5 px-3">{line.customerName}</td>
                    <td className="py-1.5 px-3 font-mono text-xs">
                      {line.invoiceNumber}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-muted-foreground">
                      {formatDate(line.invoiceDate)}
                    </td>
                    <td className="py-1.5 px-3 text-xs text-muted-foreground">
                      {formatDate(line.dueDate)}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                      {eur(line.amount)}
                    </td>
                    <td
                      className={`py-1.5 px-3 text-right font-mono tabular-nums ${cfg.color}`}
                    >
                      {line.daysOverdue}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${cfg.badgeClass}`}
                      >
                        {cfg.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              <tr className="border-t-2 font-semibold">
                <td className="py-2 px-3" colSpan={4}>
                  TOTAL
                </td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">
                  {eur(totalOutstanding)}
                </td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

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
