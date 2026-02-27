import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FilingRecord, FilingStatus } from "@/types/accountant";

export interface CrossClientFiling extends FilingRecord {
  client_name: string;
  client_business_name: string | null;
  year_end_month: number | null;
}

interface UseAllFilingsOptions {
  status?: FilingStatus | FilingStatus[];
  limit?: number;
}

export function useAllFilings(options: UseAllFilingsOptions = {}) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-all-filings", user?.id, options],
    queryFn: async (): Promise<CrossClientFiling[]> => {
      let query = supabase
        .from("filing_records")
        .select("*, accountant_client:accountant_clients(client_name, client_business_name, year_end_month)")
        .eq("accountant_id", user!.id)
        .order("tax_period_start", { ascending: false });

      if (options.status) {
        if (Array.isArray(options.status)) {
          query = query.in("status", options.status);
        } else {
          query = query.eq("status", options.status);
        }
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as {
          client_name: string;
          client_business_name: string | null;
          year_end_month: number | null;
        } | null;
        return {
          ...r,
          client_name: client?.client_name ?? "Unknown",
          client_business_name: client?.client_business_name ?? null,
          year_end_month: client?.year_end_month ?? null,
        } as CrossClientFiling;
      });
    },
    enabled: !!user,
  });
}
