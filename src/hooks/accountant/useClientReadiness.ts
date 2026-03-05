import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReadinessStep {
  key: string;
  label: string;
  description: string;
  status: "complete" | "in_progress" | "blocked";
  /** 0-100 */
  progress: number;
  /** e.g. "12 of 45 categorised" */
  detail: string;
}

export interface ClientReadiness {
  steps: ReadinessStep[];
  overallProgress: number;
  isReadyForFiling: boolean;
  periodLabel: string;
}

/**
 * Calculate filing readiness for a client across 5 stages.
 * The accountant sees this as a progress bar in the client tab.
 * Filing is locked until all steps are complete.
 */
export function useClientReadiness(
  clientUserId: string | null | undefined,
  periodStart?: string,
  periodEnd?: string,
) {
  return useQuery({
    queryKey: ["client-readiness", clientUserId, periodStart, periodEnd],
    queryFn: async (): Promise<ClientReadiness> => {
      if (!clientUserId) throw new Error("No client");

      // Default to current tax year if no period specified
      const now = new Date();
      const year = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
      const start = periodStart ?? `${year}-01-01`;
      const end = periodEnd ?? `${year}-12-31`;

      // ── 1. Bank Data Imported ──
      const { count: totalTxns } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientUserId)
        .gte("transaction_date", start)
        .lte("transaction_date", end);

      const hasBankData = (totalTxns ?? 0) > 0;

      // ── 2. Transactions Categorised ──
      const { count: uncategorised } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientUserId)
        .gte("transaction_date", start)
        .lte("transaction_date", end)
        .is("category_id", null);

      const categorisedCount = (totalTxns ?? 0) - (uncategorised ?? 0);
      const categorisedPct = totalTxns ? Math.round((categorisedCount / totalTxns) * 100) : 0;

      // ── 3. Receipts Uploaded ──
      const { count: expensesNeedingReceipts } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientUserId)
        .eq("type", "expense")
        .gte("transaction_date", start)
        .lte("transaction_date", end)
        .lt("amount", -50)
        .is("receipt_url", null);

      const { count: totalExpenses } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientUserId)
        .eq("type", "expense")
        .gte("transaction_date", start)
        .lte("transaction_date", end)
        .lt("amount", -50);

      const receiptsUploaded = (totalExpenses ?? 0) - (expensesNeedingReceipts ?? 0);
      const receiptsPct = totalExpenses ? Math.round((receiptsUploaded / totalExpenses) * 100) : 100;

      // ── 4. Reconciled ──
      const { count: unreconciledCount } = await supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", clientUserId)
        .gte("transaction_date", start)
        .lte("transaction_date", end)
        .or("is_reconciled.is.null,is_reconciled.eq.false");

      const reconciledCount = (totalTxns ?? 0) - (unreconciledCount ?? 0);
      const reconciledPct = totalTxns ? Math.round((reconciledCount / totalTxns) * 100) : 0;

      // ── 5. Questionnaire Completed ──
      const { data: questionnaire } = await supabase
        .from("period_end_questionnaires")
        .select("status")
        .eq("client_user_id", clientUserId)
        .gte("period_end", start)
        .lte("period_end", end)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      const qStatus = questionnaire?.status;
      const questionnaireComplete = qStatus === "completed" || qStatus === "reviewed";
      const questionnaireStarted = qStatus === "started";

      // ── Build steps ──
      const steps: ReadinessStep[] = [
        {
          key: "bank_data",
          label: "Bank Data",
          description: "Transaction data imported for the period",
          status: hasBankData ? "complete" : "blocked",
          progress: hasBankData ? 100 : 0,
          detail: hasBankData ? `${totalTxns} transactions` : "No data imported",
        },
        {
          key: "categorised",
          label: "Categorised",
          description: "All transactions assigned to a category",
          status: categorisedPct === 100 ? "complete" : categorisedPct > 0 ? "in_progress" : "blocked",
          progress: categorisedPct,
          detail: uncategorised
            ? `${uncategorised} still uncategorised`
            : "All categorised",
        },
        {
          key: "receipts",
          label: "Receipts",
          description: "Receipts uploaded for expenses over \u20ac50",
          status: receiptsPct === 100 ? "complete" : receiptsPct > 0 ? "in_progress" : "blocked",
          progress: receiptsPct,
          detail: expensesNeedingReceipts
            ? `${expensesNeedingReceipts} missing`
            : "All uploaded",
        },
        {
          key: "reconciled",
          label: "Reconciled",
          description: "Transactions matched and reconciled",
          status: reconciledPct === 100 ? "complete" : reconciledPct > 0 ? "in_progress" : "blocked",
          progress: reconciledPct,
          detail: unreconciledCount
            ? `${unreconciledCount} unreconciled`
            : "All reconciled",
        },
        {
          key: "questionnaire",
          label: "Questionnaire",
          description: "Period-end questionnaire completed by client",
          status: questionnaireComplete ? "complete" : questionnaireStarted ? "in_progress" : "blocked",
          progress: questionnaireComplete ? 100 : questionnaireStarted ? 50 : 0,
          detail: questionnaireComplete
            ? "Completed"
            : questionnaireStarted
              ? "Started — waiting for client"
              : qStatus === "sent"
                ? "Sent — waiting for client"
                : "Not sent yet",
        },
      ];

      const overallProgress = Math.round(
        steps.reduce((sum, s) => sum + s.progress, 0) / steps.length,
      );

      const isReadyForFiling = steps.every((s) => s.status === "complete");

      return {
        steps,
        overallProgress,
        isReadyForFiling,
        periodLabel: `${start} to ${end}`,
      };
    },
    enabled: !!clientUserId,
    staleTime: 30_000,
  });
}
