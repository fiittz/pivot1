import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BankConnection {
  id: string;
  bank_name: string;
  country: string;
  status: string;
  account_details: Array<{
    account_uid: string;
    iban?: string;
    name?: string;
    currency?: string;
  }>;
  connected_at: string | null;
  expires_at: string | null;
  last_synced_at: string | null;
}

// Irish banks supported by Enable Banking
const BASE_BANKS = [
  { name: "AIB", country: "IE", logo: "🏦", fullName: "Allied Irish Banks" },
  { name: "Bank of Ireland", country: "IE", logo: "🏦", fullName: "Bank of Ireland" },
  { name: "Permanent TSB", country: "IE", logo: "🏦", fullName: "Permanent TSB" },
  { name: "Revolut", country: "IE", logo: "🔄", fullName: "Revolut" },
  { name: "N26", country: "DE", logo: "🟢", fullName: "N26" },
];

// Add sandbox test bank in dev mode
export const IRISH_BANKS = import.meta.env.DEV
  ? [...BASE_BANKS, { name: "Mock ASPSP", country: "FI", logo: "🧪", fullName: "Sandbox Test Bank" }]
  : BASE_BANKS;

export function useOpenBanking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active connections
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ["bank-connections", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_connections")
        .select("*")
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as BankConnection[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // Start bank connection
  const connectBank = useMutation({
    mutationFn: async ({ institutionName, country }: { institutionName: string; country: string }) => {
      const { data, error } = await supabase.functions.invoke("open-banking-auth", {
        body: { institution_name: institutionName, country },
      });

      if (error) {
        const ctx = (error as any).context;
        if (ctx instanceof Response) {
          const body = await ctx.json().catch(() => null);
          if (body?.error) throw new Error(body.error);
        }
        throw new Error(error.message || "Edge function error");
      }
      if (data?.error) throw new Error(data.error);

      return data as { auth_url: string; state: string };
    },
    onSuccess: (data) => {
      // Store state in sessionStorage for callback verification
      sessionStorage.setItem("ob_state", data.state);
      // Redirect to bank auth
      window.location.href = data.auth_url;
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect: ${error.message}`);
    },
  });

  // Handle callback after bank auth
  const handleCallback = useMutation({
    mutationFn: async ({ code, state }: { code: string; state: string }) => {
      const { data, error } = await supabase.functions.invoke("open-banking-callback", {
        body: { code, state },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Connected to ${data.bank} — ${data.accounts?.length || 0} account(s) linked`);
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
      // Trigger initial sync
      syncTransactions.mutate({});
    },
    onError: (error: Error) => {
      toast.error(`Bank connection failed: ${error.message}`);
    },
  });

  // Sync transactions
  const syncTransactions = useMutation({
    mutationFn: async ({ connectionId }: { connectionId?: string } = {}) => {
      const { data, error } = await supabase.functions.invoke("sync-bank-transactions", {
        body: connectionId ? { connection_id: connectionId } : {},
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as { imported: number; skipped: number };
    },
    onSuccess: (data) => {
      if (data.imported > 0) {
        toast.success(`Synced ${data.imported} new transaction${data.imported > 1 ? "s" : ""} from your bank`);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["unmatched-transactions"] });
      } else {
        toast.info("Bank is up to date — no new transactions");
      }
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    },
    onError: (error: Error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Disconnect bank
  const disconnectBank = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from("bank_connections")
        .update({ status: "disconnected" })
        .eq("id", connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bank disconnected");
      queryClient.invalidateQueries({ queryKey: ["bank-connections"] });
    },
  });

  const activeConnections = connections.filter((c) => c.status === "active");
  const hasActiveConnection = activeConnections.length > 0;

  return {
    connections,
    activeConnections,
    hasActiveConnection,
    isLoading,
    connectBank,
    handleCallback,
    syncTransactions,
    disconnectBank,
  };
}
