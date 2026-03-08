import { useState } from "react";
import { Search, Shield, Check, Loader2, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBankConnections } from "@/hooks/useBankConnections";

type Step = "select" | "authorize" | "accounts" | "success";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BankConnectionWizard({ open, onOpenChange }: Props) {
  const { supportedBanks, connectBank, isConnecting } = useBankConnections();
  const [step, setStep] = useState<Step>("select");
  const [search, setSearch] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set(["all"]));

  const selectedBank = supportedBanks.find((b) => b.id === selectedBankId);

  const filteredBanks = search
    ? supportedBanks.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : supportedBanks;

  const handleConnect = async () => {
    if (!selectedBankId) return;
    await connectBank(selectedBankId);
    setStep("success");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("select");
      setSearch("");
      setSelectedBankId(null);
      setSelectedAccounts(new Set(["all"]));
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Connect Your Bank"}
            {step === "authorize" && `Connect to ${selectedBank?.name}`}
            {step === "accounts" && "Select Accounts"}
            {step === "success" && "Connected!"}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select Bank */}
        {step === "select" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search banks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {filteredBanks.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => { setSelectedBankId(bank.id); setStep("authorize"); }}
                  className={`p-4 rounded-xl border-2 text-center hover:border-primary transition-colors ${
                    selectedBankId === bank.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="w-10 h-10 mx-auto bg-muted rounded-lg flex items-center justify-center font-bold text-sm mb-2">
                    {bank.name.slice(0, 2).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium">{bank.name}</p>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="w-3.5 h-3.5" />
              Secured with Open Banking (PSD2)
            </div>
          </div>
        )}

        {/* Step 2: Authorize */}
        {step === "authorize" && selectedBank && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-2xl flex items-center justify-center font-bold text-xl">
              {selectedBank.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="space-y-2">
              <p className="text-sm">Balnce will request read-only access to:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Account balances</li>
                <li>Transaction history (last 12 months)</li>
                <li>Account details</li>
              </ul>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
              <Shield className="w-3.5 h-3.5" />
              Read-only access · No payments · 90-day consent · Revoke anytime
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep("select")}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
              <Button className="flex-1" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting...
                  </>
                ) : (
                  `Connect with ${selectedBank.name}`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Select Accounts (shown briefly during mock) */}
        {step === "accounts" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select which accounts to import:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                <Checkbox checked={selectedAccounts.has("all")} />
                <div>
                  <p className="text-sm font-medium">All Accounts</p>
                  <p className="text-xs text-muted-foreground">Import transactions from all accounts</p>
                </div>
              </label>
            </div>
            <Button className="w-full" onClick={() => setStep("success")}>
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-950/40 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Bank Connected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedBank?.name} is now connected. Transactions will sync automatically.
              </p>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
