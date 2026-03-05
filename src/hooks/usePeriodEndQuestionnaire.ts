import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth.tsx";
import type { PeriodEndQuestionnaire, QuestionnaireResponses } from "@/types/accountant";

/**
 * Fetch a specific questionnaire by ID (for the client filling it in).
 */
export function useQuestionnaire(questionnaireId: string | undefined) {
  return useQuery({
    queryKey: ["questionnaire", questionnaireId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_end_questionnaires")
        .select("*")
        .eq("id", questionnaireId!)
        .single();

      if (error) throw error;
      return data as PeriodEndQuestionnaire;
    },
    enabled: !!questionnaireId,
  });
}

/**
 * Fetch all questionnaires for the current client (business owner).
 */
export function useMyQuestionnaires() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-questionnaires", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("period_end_questionnaires")
        .select("*")
        .eq("client_user_id", user!.id)
        .order("period_end", { ascending: false });

      if (error) throw error;
      return (data ?? []) as PeriodEndQuestionnaire[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Submit questionnaire responses.
 */
export function useSubmitQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      questionnaireId: string;
      responses: QuestionnaireResponses;
    }) => {
      const { data, error } = await supabase
        .from("period_end_questionnaires")
        .update({
          responses: input.responses,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", input.questionnaireId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["questionnaire", variables.questionnaireId] });
      queryClient.invalidateQueries({ queryKey: ["my-questionnaires"] });
    },
  });
}
