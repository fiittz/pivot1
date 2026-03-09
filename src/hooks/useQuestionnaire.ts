import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to read questionnaire response data from Supabase.
 *
 * @param type   "ct1" | "form11"
 * @param periodKey  Tax year for CT1 (e.g. "2025"), director number for Form11 (e.g. "1")
 * @param clientUserId  Optional — pass a client's user_id when reading from the accountant side
 */
export function useQuestionnaire(
  type: "ct1" | "form11",
  periodKey: string | undefined,
  clientUserId?: string,
) {
  const { user } = useAuth();
  const targetUserId = clientUserId || user?.id;

  return useQuery({
    queryKey: ["questionnaire", type, periodKey, targetUserId],
    queryFn: async () => {
      if (!targetUserId || !periodKey) return null;

      const { data, error } = await supabase
        .from("questionnaire_responses")
        .select("response_data")
        .eq("user_id", targetUserId)
        .eq("questionnaire_type", type)
        .eq("period_key", periodKey)
        .maybeSingle();

      if (error) {
        console.error(`Error fetching ${type} questionnaire:`, error);
        return null;
      }

      return (data?.response_data as Record<string, unknown>) ?? null;
    },
    enabled: !!targetUserId && !!periodKey,
    staleTime: 30_000,
  });
}

/**
 * Mutation to save questionnaire data to Supabase (upsert).
 * Also syncs to localStorage for backward compatibility with existing reads.
 */
export function useSaveQuestionnaire() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      type,
      periodKey,
      data,
    }: {
      type: "ct1" | "form11";
      periodKey: string;
      data: Record<string, unknown>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // 1. Write to Supabase
      const { error } = await supabase
        .from("questionnaire_responses")
        .upsert(
          {
            user_id: user.id,
            questionnaire_type: type,
            period_key: periodKey,
            response_data: data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,questionnaire_type,period_key" },
        );

      if (error) throw error;

      // 2. Also write to localStorage for backward compatibility
      const lsKey =
        type === "ct1"
          ? `ct1_questionnaire_${user.id}_${periodKey}`
          : `form11_questionnaire_${user.id}_${periodKey}`;
      localStorage.setItem(lsKey, JSON.stringify(data));

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["questionnaire", variables.type, variables.periodKey],
      });
    },
  });
}
