import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmActivityLog, CrmActivityType } from "@/types/crm";

export function useProspectActivity(prospectId: string | undefined) {
  return useQuery<CrmActivityLog[]>({
    queryKey: ["crm_activity", prospectId],
    enabled: !!prospectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activity_log")
        .select("*")
        .eq("prospect_id", prospectId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmActivityLog[];
    },
  });
}

export function useAddActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      activityType,
      title,
      content,
    }: {
      prospectId: string;
      activityType: CrmActivityType;
      title: string;
      content?: string;
    }) => {
      const { error } = await supabase.from("crm_activity_log").insert({
        prospect_id: prospectId,
        activity_type: activityType,
        title,
        content: content || null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crm_activity", variables.prospectId],
      });
    },
  });
}
