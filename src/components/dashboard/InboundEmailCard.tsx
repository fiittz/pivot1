import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useMyInboundEmail } from "@/hooks/useMyInboundEmail";
import { toast } from "sonner";

export function InboundEmailCard() {
  const { data: inboundEmail } = useMyInboundEmail();
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  if (!inboundEmail) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inboundEmail);
    setCopied(true);
    toast.success("Email address copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card rounded-xl p-5 border flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipts & Invoices</p>
            <h2 className="text-base font-semibold">Forward documents to Balnce</h2>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Forward receipts and invoices to this email and we'll automatically process them for your bookkeeping.
      </p>

      <div className="flex items-center gap-2">
        <code className="flex-1 bg-secondary px-3 py-2 rounded-lg text-sm font-mono truncate">
          {inboundEmail}
        </code>
        <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0 gap-1.5">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => setShowGuide(!showGuide)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        How to set up auto-forwarding
      </button>

      {showGuide && (
        <div className="bg-secondary/50 rounded-lg p-4 space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground mb-1">Gmail</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Open Gmail Settings (gear icon) → See all settings</li>
              <li>Go to "Forwarding and POP/IMAP" tab</li>
              <li>Click "Add a forwarding address" and paste your Balnce email</li>
              <li>Confirm the verification email</li>
              <li>Select "Forward a copy of incoming mail to" and save</li>
            </ol>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Outlook / Microsoft 365</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
              <li>Go to Settings → Mail → Forwarding</li>
              <li>Check "Enable forwarding"</li>
              <li>Paste your Balnce email address</li>
              <li>Optionally check "Keep a copy of forwarded messages"</li>
              <li>Click Save</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Our AI will automatically filter out personal emails and spam — only business receipts and invoices get processed.
          </p>
        </div>
      )}
    </div>
  );
}
