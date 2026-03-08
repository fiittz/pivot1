import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Landmark, RefreshCw, Unplug, Shield, Loader2, Zap } from "lucide-react";
import { useOpenBanking, IRISH_BANKS } from "@/hooks/useOpenBanking";

export default function ConnectBankDialog() {
  const [open, setOpen] = useState(false);
  const {
    activeConnections,
    hasActiveConnection,
    connectBank,
    syncTransactions,
    disconnectBank,
  } = useOpenBanking();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={hasActiveConnection ? "outline" : "default"}
          className="rounded-xl gap-2"
        >
          <Landmark className="w-4 h-4" />
          {hasActiveConnection ? "Bank Connected" : "Connect Bank"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Open Banking
          </DialogTitle>
          <DialogDescription>
            Connect your bank for automatic transaction imports with MCC categorisation.
          </DialogDescription>
        </DialogHeader>

        {/* Active connections */}
        {activeConnections.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Connected Accounts
            </p>
            {activeConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{conn.bank_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.account_details?.length || 0} account(s)
                    {conn.last_synced_at && (
                      <> · Last synced {new Date(conn.last_synced_at).toLocaleDateString("en-IE")}</>
                    )}
                  </p>
                  {conn.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(conn.expires_at).toLocaleDateString("en-IE")}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => syncTransactions.mutate({ connectionId: conn.id })}
                    disabled={syncTransactions.isPending}
                  >
                    {syncTransactions.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                    onClick={() => disconnectBank.mutate(conn.id)}
                  >
                    <Unplug className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bank selection */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {hasActiveConnection ? "Add Another Bank" : "Select Your Bank"}
          </p>
          <div className="grid gap-2">
            {IRISH_BANKS.map((bank) => {
              const isConnected = activeConnections.some(
                (c) => c.bank_name === bank.name,
              );
              return (
                <Button
                  key={bank.name}
                  variant="outline"
                  className="justify-start h-auto py-3 px-4"
                  disabled={isConnected || connectBank.isPending}
                  onClick={() =>
                    connectBank.mutate({
                      institutionName: bank.name,
                      country: bank.country,
                    })
                  }
                >
                  <span className="text-lg mr-3">{bank.logo}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium">
                      {bank.fullName}
                      {isConnected && (
                        <span className="text-green-600 text-xs ml-2">Connected</span>
                      )}
                    </p>
                  </div>
                  {connectBank.isPending && (
                    <Loader2 className="w-4 h-4 ml-auto animate-spin" />
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Secure PSD2 connection via Enable Banking. We only get read access to your transactions — we can never move money or make payments.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Transactions include MCC merchant codes for instant AI categorisation — up to 95% accuracy vs 75% from CSV.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
