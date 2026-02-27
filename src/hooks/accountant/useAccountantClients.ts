import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AccountantClient, ClientStatus } from "@/types/accountant";

interface UseAccountantClientsOptions {
  status?: ClientStatus | ClientStatus[];
  search?: string;
}

export function useAccountantClients(options: UseAccountantClientsOptions = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-clients", user?.id, options.status, options.search],
    queryFn: async (): Promise<AccountantClient[]> => {
      if (!user) return [];

      let query = supabase
        .from("accountant_clients")
        .select("*")
        .eq("accountant_id", user.id)
        .order("created_at", { ascending: false });

      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in("status", options.status);
        } else {
          query = query.eq("status", options.status);
        }
      }

      if (options.search) {
        const term = `%${options.search}%`;
        query = query.or(
          `client_name.ilike.${term},client_email.ilike.${term},client_business_name.ilike.${term}`,
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as AccountantClient[];
    },
    enabled: !!user,
  });
}

export function useAccountantClientByUserId(clientUserId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-client-by-user", user?.id, clientUserId],
    queryFn: async (): Promise<AccountantClient | null> => {
      const { data, error } = await supabase
        .from("accountant_clients")
        .select("*")
        .eq("accountant_id", user!.id)
        .eq("client_user_id", clientUserId!)
        .eq("status", "active")
        .maybeSingle();

      if (error) throw error;
      return data as unknown as AccountantClient | null;
    },
    enabled: !!user && !!clientUserId,
  });
}

export function useAccountantClientCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-client-counts", user?.id],
    queryFn: async () => {
      if (!user) return { total: 0, active: 0, pending: 0, archived: 0 };

      const { data, error } = await supabase
        .from("accountant_clients")
        .select("status")
        .eq("accountant_id", user.id);

      if (error) throw error;

      const rows = data || [];
      return {
        total: rows.length,
        active: rows.filter((r) => r.status === "active").length,
        pending: rows.filter((r) => r.status === "pending_invite").length,
        archived: rows.filter((r) => r.status === "archived").length,
      };
    },
    enabled: !!user,
  });
}
