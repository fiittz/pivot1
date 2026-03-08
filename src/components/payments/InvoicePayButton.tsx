import { useState } from "react";
import {
  CreditCard,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useStripeAccount, useCreateCheckout, useInvoicePayments } from "@/hooks/useStripeConnect";

interface InvoicePayButtonProps {
  invoiceId: string;
  totalAmount: number;
  isPaid: boolean;
  paymentLink?: string | null;
  paidAt?: string | null;
  paymentMethod?: string | null;
}

export function InvoicePayButton({
  invoiceId,
  totalAmount,
  isPaid,
  paymentLink: existingLink,
  paidAt,
  paymentMethod,
}: InvoicePayButtonProps) {
  const { data: stripeAccount } = useStripeAccount();
  const { data: payments } = useInvoicePayments(invoiceId);
  const createCheckout = useCreateCheckout();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const activeLink = generatedLink || existingLink;
  const hasStripe = stripeAccount?.charges_enabled;

  // If paid, show paid badge
  if (isPaid) {
    const paidDate = paidAt
      ? new Date(paidAt).toLocaleDateString("en-IE", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

    return (
      <div className="flex items-center gap-3">
        <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
          <Check className="w-3 h-3" />
          Paid
        </Badge>
        {paidDate && (
          <span className="text-sm text-muted-foreground">
            {paidDate}
            {paymentMethod ? ` via ${paymentMethod}` : ""}
          </span>
        )}
      </div>
    );
  }

  // If Stripe is not set up, don't show anything
  if (!hasStripe) {
    return null;
  }

  const handleGenerate = async () => {
    try {
      const result = await createCheckout.mutateAsync(invoiceId);
      setGeneratedLink(result.url);
      toast.success("Payment link created");
    } catch {
      // Error handled by the mutation's onError
    }
  };

  const handleCopy = () => {
    if (activeLink) {
      navigator.clipboard.writeText(activeLink);
      toast.success("Payment link copied to clipboard");
    }
  };

  return (
    <div className="space-y-3">
      {activeLink ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={activeLink}
              readOnly
              className="text-xs font-mono h-8"
            />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              asChild
            >
              <a href={activeLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleGenerate}
              disabled={createCheckout.isPending}
            >
              {createCheckout.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5" />
              )}
              Generate New Link
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleGenerate}
          disabled={createCheckout.isPending}
        >
          {createCheckout.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          Generate Payment Link
        </Button>
      )}

      {/* Show recent payment attempts */}
      {payments && payments.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          {payments.slice(0, 3).map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span>
                {new Date(p.created_at).toLocaleDateString("en-IE", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <Badge
                variant={
                  p.status === "succeeded"
                    ? "default"
                    : p.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className={
                  p.status === "succeeded"
                    ? "bg-green-600 text-xs"
                    : "text-xs"
                }
              >
                {p.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
