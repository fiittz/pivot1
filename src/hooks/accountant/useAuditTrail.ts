import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AuditEntityType, AuditEvent } from "@/services/auditTrailService";

const PAGE_SIZE = 50;

export interface AuditTrailFilters {
  entityType?: AuditEntityType;
  dateFrom?: string; // ISO date string
  dateTo?: string;   // ISO date string
}

/**
 * Paginated query for a client's audit trail.
 * Returns sorted by created_at desc, 50 per page with load-more via useInfiniteQuery.
 */
export function useClientAuditTrail(
  clientUserId: string | null | undefined,
  filters?: AuditTrailFilters,
) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: [
      "client-audit-trail",
      clientUserId,
      filters?.entityType,
      filters?.dateFrom,
      filters?.dateTo,
    ],
    queryFn: async ({ pageParam = 0 }): Promise<AuditEvent[]> => {
      let query = supabase
        .from("audit_trail")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (filters?.entityType) {
        query = query.eq("entity_type", filters.entityType);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as AuditEvent[];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: !!user && !!clientUserId,
    staleTime: 30_000,
  });
}
