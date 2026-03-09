import { CreditCard, Check, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStripeAccount, useStripeOnboard } from "@/hooks/useStripeConnect";

export function PaymentSetupCard() {
  const { data: account, isLoading } = useStripeAccount();
  const onboard = useStripeOnboard();

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading payment setup...</span>
        </CardContent>
      </Card>
    );
  }

  const isConnected = account?.charges_enabled && account?.onboarding_complete;
  const isPartial = account && !account.onboarding_complete;

  // Steps for onboarding feel
  const steps = [
    {
      label: "Automatic reconciliation -- payments create transactions instantly",
      done: true,
    },
    {
      label: "No manual matching needed",
      done: true,
    },
    {
      label: "Customers pay via a secure Stripe link",
      done: true,
    },
    {
      label: "Money goes directly to your bank account",
      done: true,
    },
  ];

  return (
    <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Accept Payments on Invoices
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="text-[10px] rounded-full px-2 bg-green-100 text-green-700 border-green-200 gap-1">
              <Check className="w-2.5 h-2.5" />
              Connected
            </Badge>
          ) : isPartial ? (
            <Badge variant="outline" className="text-[10px] rounded-full px-2 bg-amber-100 text-amber-800 border-amber-200 gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Incomplete
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] rounded-full px-2">
              Not Connected
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Connect your business to accept card payments, Apple Pay, and bank transfers
          directly on your invoices.
        </p>

        {/* Benefits / steps */}
        <div className="space-y-2.5">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm text-muted-foreground">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Action area */}
        <div className="flex items-center justify-between pt-3 border-t border-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {isConnected ? (
              <span className="text-sm text-green-600 font-medium">Ready to accept payments</span>
            ) : isPartial ? (
              <span className="text-sm text-amber-600 font-medium">Setup incomplete</span>
            ) : (
              <span className="text-sm text-muted-foreground">Not yet connected</span>
            )}
          </div>

          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Stripe Dashboard
              </a>
            </Button>
          ) : isPartial ? (
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
              onClick={() => onboard.mutate()}
              disabled={onboard.isPending}
            >
              {onboard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              Complete Setup
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => onboard.mutate()}
              disabled={onboard.isPending}
            >
              {onboard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Enable Payments
            </Button>
          )}
        </div>

        {/* Fee disclosure */}
        {isConnected && account && (
          <p className="text-xs text-muted-foreground">
            Platform fee: {account.platform_fee_pct}% per transaction.
            Stripe&apos;s standard processing fees also apply.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
