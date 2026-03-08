import { CreditCard, Check, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStripeAccount, useStripeOnboard } from "@/hooks/useStripeConnect";

export function PaymentSetupCard() {
  const { data: account, isLoading } = useStripeAccount();
  const onboard = useStripeOnboard();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isConnected = account?.charges_enabled && account?.onboarding_complete;
  const isPartial = account && !account.onboarding_complete;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          <CardTitle className="text-lg">Accept Payments on Invoices</CardTitle>
        </div>
        <CardDescription>
          Connect your business to accept card payments, Apple Pay, and bank transfers
          directly on your invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Benefits list */}
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            Automatic reconciliation — payments create transactions instantly
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            No manual matching needed
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            Customers pay via a secure Stripe link
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500 shrink-0" />
            Money goes directly to your bank account
          </li>
        </ul>

        {/* Status + Action */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {isConnected ? (
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : isPartial ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Setup Incomplete
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
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
              onClick={() => onboard.mutate()}
              disabled={onboard.isPending}
            >
              {onboard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <AlertCircle className="w-4 h-4 mr-1.5" />
              )}
              Complete Setup
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onboard.mutate()}
              disabled={onboard.isPending}
            >
              {onboard.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <CreditCard className="w-4 h-4 mr-1.5" />
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
