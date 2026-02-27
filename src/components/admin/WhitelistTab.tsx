import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useApprovedAccountants, useAddApprovedAccountant, useRemoveApprovedAccountant } from "@/hooks/admin/useApprovedAccountants";
import { toast } from "sonner";

export default function WhitelistTab() {
  const [email, setEmail] = useState("");
  const { data: accountants = [], isLoading } = useApprovedAccountants();
  const addMutation = useAddApprovedAccountant();
  const removeMutation = useRemoveApprovedAccountant();

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      await addMutation.mutateAsync(trimmed);
      toast.success(`${trimmed} added to approved accountants`);
      setEmail("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("This email is already approved");
      } else {
        toast.error(msg || "Failed to add email");
      }
    }
  };

  const handleRemove = async (id: string, accountantEmail: string) => {
    try {
      await removeMutation.mutateAsync(id);
      toast.success(`${accountantEmail} revoked`);
    } catch {
      toast.error("Failed to revoke email");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-['IBM_Plex_Mono'] text-sm uppercase tracking-widest">
          Approved Accountants
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex gap-2"
        >
          <Input
            type="email"
            placeholder="accountant@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={addMutation.isPending}>
            {addMutation.isPending ? "Adding..." : "Add"}
          </Button>
        </form>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : accountants.length === 0 ? (
          <p className="text-muted-foreground text-sm">No approved accountants yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountants.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(a.id, a.email)}
                      disabled={removeMutation.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
