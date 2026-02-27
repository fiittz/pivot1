import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ActivityType = "filing" | "task" | "document" | "note" | "client";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  clientName: string;
  timestamp: string;
}

export function useRecentActivity() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-recent-activity", user?.id],
    queryFn: async (): Promise<ActivityItem[]> => {
      const accountantId = user!.id;

      // Run 5 queries in parallel, each limited to 10 rows
      const [filings, tasks, docs, notes, clients] = await Promise.all([
        supabase
          .from("filing_records")
          .select("id, filing_type, status, updated_at, accountant_client:accountant_clients(client_name)")
          .eq("accountant_id", accountantId)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("client_tasks")
          .select("id, title, status, updated_at, accountant_client:accountant_clients(client_name)")
          .eq("accountant_id", accountantId)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("document_requests")
          .select("id, title, status, updated_at, accountant_client:accountant_clients(client_name)")
          .eq("accountant_id", accountantId)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("client_notes")
          .select("id, title, updated_at, accountant_client:accountant_clients(client_name)")
          .eq("accountant_id", accountantId)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("accountant_clients")
          .select("id, client_name, created_at")
          .eq("accountant_id", accountantId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const items: ActivityItem[] = [];

      // Filings
      for (const row of filings.data ?? []) {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as { client_name: string } | null;
        const filingType = (r.filing_type as string).toUpperCase().replace("_", " ");
        items.push({
          id: `filing-${r.id}`,
          type: "filing",
          description: `${filingType} filing marked as ${r.status}`,
          clientName: client?.client_name ?? "Unknown",
          timestamp: r.updated_at as string,
        });
      }

      // Tasks
      for (const row of tasks.data ?? []) {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as { client_name: string } | null;
        items.push({
          id: `task-${r.id}`,
          type: "task",
          description: `Task "${r.title}" updated to ${r.status}`,
          clientName: client?.client_name ?? "Unknown",
          timestamp: r.updated_at as string,
        });
      }

      // Documents
      for (const row of docs.data ?? []) {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as { client_name: string } | null;
        items.push({
          id: `doc-${r.id}`,
          type: "document",
          description: `Document "${r.title}" — ${r.status}`,
          clientName: client?.client_name ?? "Unknown",
          timestamp: r.updated_at as string,
        });
      }

      // Notes
      for (const row of notes.data ?? []) {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as { client_name: string } | null;
        items.push({
          id: `note-${r.id}`,
          type: "note",
          description: `Note "${r.title}" updated`,
          clientName: client?.client_name ?? "Unknown",
          timestamp: r.updated_at as string,
        });
      }

      // Clients
      for (const row of clients.data ?? []) {
        const r = row as Record<string, unknown>;
        items.push({
          id: `client-${r.id}`,
          type: "client",
          description: `Client "${r.client_name}" added`,
          clientName: r.client_name as string,
          timestamp: r.created_at as string,
        });
      }

      // Sort by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return items.slice(0, 20);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
