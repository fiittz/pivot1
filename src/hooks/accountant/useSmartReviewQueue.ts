import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth.tsx";

export type Priority = "high" | "medium" | "low";

export interface ReviewQueueItem {
  clientId: string;
  clientUserId: string;
  clientName: string;
  priority: Priority;
  score: number;
  reasons: string[];
  uncategorisedCount: number;
  missingReceiptsCount: number;
  pendingQuestionnaires: number;
  pendingEmailReview: number;
  daysUntilDeadline: number | null;
}

/**
 * Smart review queue — aggregates all client health signals into a
 * prioritised list for the accountant's dashboard.
 */
export function useSmartReviewQueue() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["smart-review-queue", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch all active clients
      const { data: clients } = await supabase
        .from("accountant_clients")
        .select("id, client_user_id, client_name, year_end_month")
        .eq("accountant_id", user.id)
        .eq("status", "active")
        .not("client_user_id", "is", null);

      if (!clients || clients.length === 0) return [];

      const queue: ReviewQueueItem[] = [];
      const now = new Date();

      for (const client of clients) {
        try {
          const clientUserId = client.client_user_id as string;
          let score = 0;
          const reasons: string[] = [];

          // 1. Uncategorised transactions
          const { count: uncatCount } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", clientUserId)
            .is("category_id", null);

          const uncategorisedCount = uncatCount ?? 0;
          if (uncategorisedCount > 0) {
            score += Math.min(uncategorisedCount * 2, 30);
            reasons.push(`${uncategorisedCount} uncategorised transactions`);
          }

          // 2. Missing receipts (expenses > €50 without receipt)
          const { count: receiptCount } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", clientUserId)
            .eq("type", "expense")
            .is("receipt_url", null)
            .lt("amount", -50);

          const missingReceiptsCount = receiptCount ?? 0;
          if (missingReceiptsCount > 0) {
            score += Math.min(missingReceiptsCount, 15);
            reasons.push(`${missingReceiptsCount} missing receipts`);
          }

          // 3. Pending questionnaires
          const { count: questCount } = await supabase
            .from("period_end_questionnaires")
            .select("id", { count: "exact", head: true })
            .eq("accountant_id", user.id)
            .eq("client_user_id", clientUserId)
            .eq("status", "completed"); // completed but not yet reviewed

          const pendingQuestionnaires = questCount ?? 0;
          if (pendingQuestionnaires > 0) {
            score += 20;
            reasons.push(`${pendingQuestionnaires} questionnaire${pendingQuestionnaires > 1 ? "s" : ""} to review`);
          }

          // 4. Inbound emails needing review
          const { count: emailCount } = await supabase
            .from("inbound_emails")
            .select("id", { count: "exact", head: true })
            .eq("client_user_id", clientUserId)
            .eq("status", "processed")
            .eq("route", "accountant_queue");

          const pendingEmailReview = emailCount ?? 0;
          if (pendingEmailReview > 0) {
            score += pendingEmailReview * 5;
            reasons.push(`${pendingEmailReview} email${pendingEmailReview > 1 ? "s" : ""} need review`);
          }

          // 5. Deadline proximity
          let daysUntilDeadline: number | null = null;
          if (client.year_end_month) {
            const yem = client.year_end_month as number;
            let yearEndYear = now.getFullYear();
            const yearEnd = new Date(yearEndYear, yem, 0); // Last day of year_end_month
            if (yearEnd < now) yearEndYear++;
            const nextYearEnd = new Date(yearEndYear, yem, 0);
            daysUntilDeadline = Math.ceil((nextYearEnd.getTime() - now.getTime()) / 86400000);

            if (daysUntilDeadline <= 14) {
              score += 40;
              reasons.push(`Year-end in ${daysUntilDeadline} days`);
            } else if (daysUntilDeadline <= 30) {
              score += 20;
              reasons.push(`Year-end in ${daysUntilDeadline} days`);
            } else if (daysUntilDeadline <= 60) {
              score += 5;
            }
          }

          // Determine priority bucket
          let priority: Priority = "low";
          if (score >= 40) priority = "high";
          else if (score >= 15) priority = "medium";

          queue.push({
            clientId: client.id,
            clientUserId,
            clientName: client.client_name ?? "Unknown",
            priority,
            score,
            reasons,
            uncategorisedCount,
            missingReceiptsCount,
            pendingQuestionnaires,
            pendingEmailReview,
            daysUntilDeadline,
          });
        } catch {
          // Skip this client on error — don't crash the whole queue
          console.warn(`[useSmartReviewQueue] Failed to fetch data for client ${client.id}, skipping`);
        }
      }

      // Sort by score descending
      queue.sort((a, b) => b.score - a.score);
      return queue;
    },
    enabled: !!user?.id,
    staleTime: 60_000, // Re-fetch every minute at most
  });
}
