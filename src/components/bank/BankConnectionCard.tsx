import { RefreshCw, Unlink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { BankConnection } from "@/types/bankConnection";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

function timeAgo(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  connection: BankConnection;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export default function BankConnectionCard({ connection, onSync, onDisconnect }: Props) {
  const consentDaysLeft = connection.consentExpiresAt
    ? Math.floor((new Date(connection.consentExpiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center font-bold text-sm">
            {connection.institutionName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold">{connection.institutionName}</h3>
            <p className="text-xs text-muted-foreground">Last synced: {timeAgo(connection.lastSyncedAt)}</p>
          </div>
        </div>
        <Badge className={STATUS_STYLES[connection.status]}>
          {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
        </Badge>
      </div>

      {/* Accounts */}
      {connection.accounts.length > 0 && (
        <div className="space-y-2">
          {connection.accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between text-sm p-2.5 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{acc.accountName}</p>
                <p className="text-xs text-muted-foreground">{acc.accountNumber} · {acc.type}</p>
              </div>
              <p className="font-semibold tabular-nums">€{acc.balance.toLocaleString("en-IE", { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
        </div>
      )}

      {/* Consent warning */}
      {consentDaysLeft !== null && consentDaysLeft < 30 && consentDaysLeft > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          Consent expires in {consentDaysLeft} days — re-authorize soon
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => onSync(connection.id)}>
          <RefreshCw className="w-3.5 h-3.5" /> Sync Now
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {connection.institutionName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the connection. Your existing transactions will not be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDisconnect(connection.id)}>Disconnect</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
