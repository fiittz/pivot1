import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Eye, Pause, Play } from "lucide-react";
import { useRegisteredAccountants } from "@/hooks/admin/useRegisteredAccountants";
import { useAccountantClients } from "@/hooks/admin/useAccountantClients";
import { useSuspendAccountant, useReactivateAccountant } from "@/hooks/admin/useSuspendAccountant";
import { toast } from "sonner";
import type { RegisteredAccountant, AccountantStatus } from "@/types/accountant";

function StatusBadge({ status }: { status: AccountantStatus }) {
  const variants: Record<AccountantStatus, { className: string; label: string }> = {
    active: { className: "bg-green-100 text-green-800 hover:bg-green-100", label: "Active" },
    suspended: { className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100", label: "Suspended" },
    revoked: { className: "bg-red-100 text-red-800 hover:bg-red-100", label: "Revoked" },
  };
  const v = variants[status] ?? variants.active;
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function ClientsDialog({
  accountant,
  open,
  onOpenChange,
}: {
  accountant: RegisteredAccountant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: clients = [], isLoading } = useAccountantClients(
    open && accountant ? accountant.user_id : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-['IBM_Plex_Mono'] text-sm uppercase tracking-widest">
            Clients of {accountant?.display_name ?? accountant?.email}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-4">Loading clients...</p>
        ) : clients.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">No clients assigned yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Signed Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.client_id}>
                  <TableCell className="font-medium">
                    {c.business_name || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.email}</TableCell>
                  <TableCell>{c.transaction_count}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(c.signed_up_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AccountantsTab() {
  const { data: accountants = [], isLoading } = useRegisteredAccountants();
  const suspendMutation = useSuspendAccountant();
  const reactivateMutation = useReactivateAccountant();

  const [suspendTarget, setSuspendTarget] = useState<RegisteredAccountant | null>(null);
  const [clientsTarget, setClientsTarget] = useState<RegisteredAccountant | null>(null);

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    try {
      await suspendMutation.mutateAsync(suspendTarget.email);
      toast.success(`${suspendTarget.email} suspended`);
    } catch {
      toast.error("Failed to suspend accountant");
    } finally {
      setSuspendTarget(null);
    }
  };

  const handleReactivate = async (acct: RegisteredAccountant) => {
    try {
      await reactivateMutation.mutateAsync(acct.email);
      toast.success(`${acct.email} reactivated`);
    } catch {
      toast.error("Failed to reactivate accountant");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="font-['IBM_Plex_Mono'] text-sm uppercase tracking-widest">
            Registered Accountants
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : accountants.length === 0 ? (
            <p className="text-muted-foreground text-sm">No accountants have signed up yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountants.map((a) => (
                  <TableRow key={a.user_id}>
                    <TableCell className="font-mono text-sm">{a.email}</TableCell>
                    <TableCell>{a.display_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(a.signed_up_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell>{a.client_count}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setClientsTarget(a)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Clients
                          </DropdownMenuItem>
                          {a.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => setSuspendTarget(a)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Suspend
                            </DropdownMenuItem>
                          ) : a.status === "suspended" ? (
                            <DropdownMenuItem onClick={() => handleReactivate(a)}>
                              <Play className="mr-2 h-4 w-4" />
                              Reactivate
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Suspend confirmation */}
      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend Accountant</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend <span className="font-mono font-semibold">{suspendTarget?.email}</span> and
              remove their accountant role. They will lose access to accountant features immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clients dialog */}
      <ClientsDialog
        accountant={clientsTarget}
        open={!!clientsTarget}
        onOpenChange={(open) => !open && setClientsTarget(null)}
      />
    </>
  );
}
