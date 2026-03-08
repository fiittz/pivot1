import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBankConnections } from "@/hooks/useBankConnections";
import BankConnectionCard from "./BankConnectionCard";
import BankConnectionWizard from "./BankConnectionWizard";

export default function BankConnectionList() {
  const { connections, syncBank, disconnectBank } = useBankConnections();
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bank Connections</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setWizardOpen(true)}>
          <Plus className="w-4 h-4" /> Connect Bank
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="bg-card rounded-xl border p-8 text-center space-y-3">
          <div className="w-14 h-14 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Link2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No banks connected</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Connect your Irish bank account to automatically import transactions. Supports AIB, Bank of Ireland, PTSB, Revolut, and more.
          </p>
          <Button onClick={() => setWizardOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Connect Your First Bank
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {connections.map((conn) => (
            <BankConnectionCard
              key={conn.id}
              connection={conn}
              onSync={syncBank}
              onDisconnect={disconnectBank}
            />
          ))}
        </div>
      )}

      <BankConnectionWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
