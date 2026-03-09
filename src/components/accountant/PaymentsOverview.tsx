import { useMemo } from "react";
import {
  CreditCard,
  Check,
  AlertCircle,
  TrendingUp,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientStripeAccount, useClientPayments } from "@/hooks/useStripeConnect";

interface PaymentsOverviewProps {
  clientUserId: string;
}

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  succeeded: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Succeeded" },
  pending: { color: "bg-amber-100 text-amber-700 border-amber-200", label: "Pending" },
  failed: { color: "bg-red-100 text-red-700 border-red-200", label: "Failed" },
  refunded: { color: "bg-gray-100 text-gray-600 border-gray-200", label: "Refunded" },
};

export function PaymentsOverview({ clientUserId }: PaymentsOverviewProps) {
  const { data: stripeAccount, isLoading: accountLoading } = useClientStripeAccount(clientUserId);
  const { data: payments, isLoading: paymentsLoading } = useClientPayments(clientUserId);

  const isLoading = accountLoading || paymentsLoading;

  // Summary calculations
  const summary = useMemo(() => {
    if (!payments || payments.length === 0) {
      return { totalCollected: 0, platformFees: 0, refunds: 0, pendingCount: 0, successCount: 0 };
    }

    const succeeded = payments.filter((p) => p.status === "succeeded");
    const totalCollected = succeeded.reduce((sum, p) => sum + Number(p.amount), 0);
    const platformFees = succeeded.reduce((sum, p) => sum + Number(p.platform_fee), 0);
    const refunded = payments.filter((p) => p.status === "refunded");
    const refunds = refunded.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingCount = payments.filter((p) => p.status === "pending").length;
    const successCount = succeeded.length;

    return { totalCollected, platformFees, refunds, pendingCount, successCount };
  }, [payments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading payments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stripe account status */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Payment Collection
            </h4>
          </div>
          {stripeAccount ? (
            stripeAccount.charges_enabled ? (
              <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <Check className="w-3 h-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 gap-1">
                <AlertCircle className="w-3 h-3" />
                Setup Incomplete
              </Badge>
            )
          ) : (
            <Badge variant="secondary" className="text-[10px]">Not Connected</Badge>
          )}
        </div>
        {stripeAccount && (
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Platform fee: <span className="font-medium text-foreground">{stripeAccount.platform_fee_pct}%</span>
              {stripeAccount.stripe_account_id && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  ({stripeAccount.stripe_account_id})
                </span>
              )}
            </p>
          </CardContent>
        )}
      </Card>

      {/* Summary stats */}
      {stripeAccount?.charges_enabled && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-xs text-muted-foreground">Total Collected</p>
              </div>
              <p className="text-xl font-semibold font-mono tabular-nums text-emerald-700">
                {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(summary.totalCollected)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Platform Fees</p>
              </div>
              <p className="text-xl font-semibold font-mono tabular-nums">
                {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(summary.platformFees)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Refunds</p>
              </div>
              <p className="text-xl font-semibold font-mono tabular-nums text-red-600">
                {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(summary.refunds)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <p className="text-xs text-muted-foreground">Successful</p>
              </div>
              <p className="text-xl font-semibold tabular-nums">{summary.successCount}</p>
              {summary.pendingCount > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">
                  {summary.pendingCount} pending
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payments table */}
      {payments && payments.length > 0 ? (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Payments
            </h4>
          </div>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/10 border-b">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Customer</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Method</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => {
                    const statusCfg = STATUS_BADGE[payment.status] ?? STATUS_BADGE.pending;
                    return (
                      <tr key={payment.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {new Date(payment.created_at).toLocaleDateString("en-IE", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {payment.customer_email || "\u2014"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-medium">
                          {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(payment.amount))}
                        </td>
                        <td className="py-2 px-3 text-sm capitalize text-muted-foreground">
                          {payment.payment_method_type || "\u2014"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                            {statusCfg.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : stripeAccount?.charges_enabled ? (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CreditCard className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No payments received yet.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
