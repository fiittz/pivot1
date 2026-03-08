import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface PracticeKPIs {
  totalClients: number;
  averageCategorizationRate: number;
  totalUncategorizedTransactions: number;
  clientsNeedingAttention: { id: string; name: string; uncategorized: number }[];
  receiptCoverage: number;
  clientHealthRows: ClientHealthRow[];
}

export interface ClientHealthRow {
  clientId: string;
  clientName: string;
  email: string;
  uncategorizedCount: number;
  totalTransactions: number;
  categorizationRate: number;
  lastActivity: string | null;
  filingStatus: "up_to_date" | "pending" | "overdue";
}

export function usePracticeKPIs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["practice-kpis", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      // Get practice
      const { data: practice } = await supabase
        .from("accountant_practices")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!practice) return null;

      // Get all clients
      const { data: clients } = await supabase
        .from("accountant_clients")
        .select("id, client_id, status, profiles:client_id(full_name, email)")
        .eq("practice_id", practice.id)
        .eq("status", "active");

      if (!clients || clients.length === 0) return null;

      const clientIds = clients.map((c) => c.client_id);

      // Get transaction counts per client
      const { data: txData } = await supabase
        .from("transactions")
        .select("user_id, category_id, receipt_url, created_at")
        .in("user_id", clientIds);

      const txByClient = new Map<string, { total: number; uncategorized: number; withReceipt: number; lastDate: string | null }>();
      for (const cid of clientIds) {
        txByClient.set(cid, { total: 0, uncategorized: 0, withReceipt: 0, lastDate: null });
      }

      for (const tx of txData || []) {
        const entry = txByClient.get(tx.user_id);
        if (!entry) continue;
        entry.total++;
        if (!tx.category_id) entry.uncategorized++;
        if (tx.receipt_url) entry.withReceipt++;
        if (!entry.lastDate || (tx.created_at && tx.created_at > entry.lastDate)) {
          entry.lastDate = tx.created_at;
        }
      }

      // Build health rows
      const healthRows: ClientHealthRow[] = clients.map((c) => {
        const stats = txByClient.get(c.client_id) || { total: 0, uncategorized: 0, withReceipt: 0, lastDate: null };
        const profile = c.profiles as unknown as { full_name: string | null; email: string | null } | null;
        return {
          clientId: c.client_id,
          clientName: profile?.full_name || profile?.email || "Unknown",
          email: profile?.email || "",
          uncategorizedCount: stats.uncategorized,
          totalTransactions: stats.total,
          categorizationRate: stats.total > 0 ? Math.round(((stats.total - stats.uncategorized) / stats.total) * 100) : 100,
          lastActivity: stats.lastDate,
          filingStatus: stats.uncategorized > 20 ? "overdue" : stats.uncategorized > 5 ? "pending" : "up_to_date",
        };
      });

      const totalTx = healthRows.reduce((s, r) => s + r.totalTransactions, 0);
      const totalUncat = healthRows.reduce((s, r) => s + r.uncategorizedCount, 0);
      const totalWithReceipt = Array.from(txByClient.values()).reduce((s, v) => s + v.withReceipt, 0);
      const totalExpenses = (txData || []).filter((t) => !t.category_id || t.category_id).length; // all tx for receipt coverage

      const kpis: PracticeKPIs = {
        totalClients: clients.length,
        averageCategorizationRate: totalTx > 0 ? Math.round(((totalTx - totalUncat) / totalTx) * 100) : 100,
        totalUncategorizedTransactions: totalUncat,
        clientsNeedingAttention: healthRows
          .filter((r) => r.uncategorizedCount > 20)
          .map((r) => ({ id: r.clientId, name: r.clientName, uncategorized: r.uncategorizedCount })),
        receiptCoverage: totalExpenses > 0 ? Math.round((totalWithReceipt / totalExpenses) * 100) : 0,
        clientHealthRows: healthRows.sort((a, b) => b.uncategorizedCount - a.uncategorizedCount),
      };

      return kpis;
    },
    enabled: !!user?.id,
  });
}
