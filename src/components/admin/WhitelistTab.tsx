import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useApprovedAccountants, useAddApprovedAccountant, useRemoveApprovedAccountant } from "@/hooks/admin/useApprovedAccountants";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function generateTempPassword() {
  return crypto.randomUUID().slice(0, 16) + "!A1";
}

export default function WhitelistTab() {
  const [email, setEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { data: accountants = [], isLoading } = useApprovedAccountants();
  const addMutation = useAddApprovedAccountant();
  const removeMutation = useRemoveApprovedAccountant();

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsAdding(true);
    try {
      // 1. Add to whitelist
      await addMutation.mutateAsync(trimmed);

      // 2. Create their auth account with a temp password
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: trimmed,
        password: generateTempPassword(),
        options: {
          emailRedirectTo: `${window.location.origin}/accountant`,
          data: { is_accountant: true },
        },
      });

      if (signUpError) {
        // 422 = already registered, which is fine
        if (!signUpError.message.includes("already registered")) {
          console.error("Signup error:", signUpError);
        }
      }

      // 3. Add accountant role if account was just created
      if (signUpData?.user) {
        await supabase.from("user_roles").insert({
          user_id: signUpData.user.id,
          role: "accountant",
        }).then(({ error }) => {
          if (error && !error.message.includes("duplicate")) {
            console.error("Role insert error:", error);
          }
        });
      }

      // 4. Send password reset so they can set their own password
      await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      // 5. Clear any accidental session from the signUp call
      await supabase.auth.signOut();

      toast.success(`${trimmed} added — they'll get an email to set their password`);
      setEmail("");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("This email is already approved");
      } else {
        toast.error(msg || "Failed to add accountant");
      }
    } finally {
      setIsAdding(false);
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
          <Button type="submit" disabled={isAdding}>
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          Adding an email creates their account and sends them a password setup email.
        </p>

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
