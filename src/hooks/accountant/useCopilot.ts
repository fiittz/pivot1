import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CopilotSuggestion {
  type: "miscategorisation" | "missing_relief" | "compliance_risk" | "optimisation" | "missing_receipt" | "inconsistency";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  legislation: string | null;
  action: string;
  estimated_impact: string | null;
  affected_transactions?: string[];
}

/** Toggle co-pilot on/off for a client */
export function useToggleCopilot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountantClientId, enabled }: { accountantClientId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("accountant_clients")
        .update({ copilot_enabled: enabled })
        .eq("id", accountantClientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountant-client"] });
    },
  });
}

/** Run co-pilot analysis for a client filing */
export function useCopilotAnalysis(
  clientUserId: string | undefined,
  filingType: string | undefined,
  taxYear: number | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["copilot-analysis", clientUserId, filingType, taxYear],
    queryFn: async (): Promise<CopilotSuggestion[]> => {
      const { data, error } = await supabase.functions.invoke("accountant-copilot", {
        body: {
          client_user_id: clientUserId,
          filing_type: filingType,
          tax_year: taxYear,
          action: "review_filing",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data?.suggestions || [];
    },
    enabled: enabled && !!clientUserId && !!filingType && !!taxYear,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });
}
