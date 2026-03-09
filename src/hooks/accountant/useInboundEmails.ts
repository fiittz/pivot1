import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { InboundEmail } from "@/types/accountant";

/**
 * Fetch inbound emails for a specific client, or all emails for the practice.
 */
export function useInboundEmails(
  clientUserId?: string | null,
  statusFilter?: string,
) {
  return useQuery({
    queryKey: ["inbound-emails", clientUserId, statusFilter],
    queryFn: async () => {
      try {
        let query = supabase
          .from("inbound_emails")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (clientUserId) {
          query = query.eq("client_user_id", clientUserId);
        }
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as InboundEmail[];
      } catch {
        console.warn(`[useInboundEmails] Failed to fetch emails for client ${clientUserId ?? "all"}`);
        return [] as InboundEmail[];
      }
    },
  });
}

/**
 * Fetch email pipeline stats for the accountant dashboard.
 */
export function useInboundEmailStats() {
  return useQuery({
    queryKey: ["inbound-email-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inbound_emails")
        .select("status, route");

      if (error) throw error;

      const stats = {
        total: data?.length ?? 0,
        pending: 0,
        processing: 0,
        auto_filed: 0,
        pending_review: 0,
        accountant_queue: 0,
        ignored: 0,
        failed: 0,
        unmatched: 0,
      };

      for (const row of data ?? []) {
        if (row.status === "pending" || row.status === "triaging" || row.status === "extracting" || row.status === "enriching") {
          stats.processing++;
        } else if (row.status === "processed") {
          if (row.route === "auto_filed") stats.auto_filed++;
          else if (row.route === "pending_review") stats.pending_review++;
          else if (row.route === "accountant_queue") stats.accountant_queue++;
        } else if (row.status === "ignored") stats.ignored++;
        else if (row.status === "failed") stats.failed++;
        else if (row.status === "unmatched") stats.unmatched++;
      }

      return stats;
    },
  });
}
