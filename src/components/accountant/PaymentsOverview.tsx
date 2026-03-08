import { useMemo } from "react";
import {
  CreditCard,
  Check,
  AlertCircle,
  TrendingUp,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClientStripeAccount, useClientPayments } from "@/hooks/useStripeConnect";

interface PaymentsOverviewProps {
  clientUserId: string;
}

export function PaymentsOverview({ clientUserId }: PaymentsOverviewProps) {
  const { data: stripeAccount, isLoading: accountLoading } = useClientStripeAccount(clientUserId);
  const { data: payments, isLoading: paymentsLoading } = useClientPayments(clientUserId);

  const isLoading = accountLoading || paymentsLoading;

  // Summary calculations
  const summary = useMemo(() => {
    if (!payments || payments.length === 0) {
      return { totalThisMonth: 0, feesThisMonth: 0, pendingCount: 0, successCount: 0 };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = payments.filter(
      (p) => new Date(p.created_at) >= monthStart
    );

    const succeeded = thisMonth.filter((p) => p.status === "succeeded");
    const totalThisMonth = succeeded.reduce((sum, p) => sum + Number(p.amount), 0);
    const feesThisMonth = succeeded.reduce((sum, p) => sum + Number(p.platform_fee), 0);
    const pendingCount = payments.filter((p) => p.status === "pending").length;
    const successCount = payments.filter((p) => p.status === "succeeded").length;

    return { totalThisMonth, feesThisMonth, pendingCount, successCount };
  }, [payments]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stripe account status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <CardTitle className="text-lg">Payment Collection</CardTitle>
            </div>
            {stripeAccount ? (
              stripeAccount.charges_enabled ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Setup Incomplete
                </Badge>
              )
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
          {stripeAccount && (
            <CardDescription>
              Platform fee: {stripeAccount.platform_fee_pct}%
              {stripeAccount.stripe_account_id && (
                <span className="ml-2 font-mono text-xs">
                  ({stripeAccount.stripe_account_id})
                </span>
              )}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Summary cards */}
      {stripeAccount?.charges_enabled && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Received this month</span>
              </div>
              <p className="text-2xl font-semibold mt-1">
                &euro;{summary.totalThisMonth.toLocaleString("en-IE", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Platform fees this month</span>
              </div>
              <p className="text-2xl font-semibold mt-1">
                &euro;{summary.feesThisMonth.toLocaleString("en-IE", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Total successful</span>
              </div>
              <p className="text-2xl font-semibold mt-1">{summary.successCount}</p>
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {new Date(payment.created_at).toLocaleDateString("en-IE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {payment.customer_email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      &euro;{Number(payment.amount).toLocaleString("en-IE", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-sm capitalize">
                      {payment.payment_method_type || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "succeeded"
                            ? "default"
                            : payment.status === "failed"
                            ? "destructive"
                            : payment.status === "refunded"
                            ? "outline"
                            : "secondary"
                        }
                        className={
                          payment.status === "succeeded"
                            ? "bg-green-600 text-xs"
                            : "text-xs"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : stripeAccount?.charges_enabled ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No payments received yet</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
