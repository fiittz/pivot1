import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmProspect, CrmStage } from "@/types/crm";

const PROSPECTS_KEY = ["crm_prospects"];

export function useProspects() {
  return useQuery<CrmProspect[]>({
    queryKey: PROSPECTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_prospects")
        .select("*")
        .order("priority", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmProspect[];
    },
  });
}

export function useUpdateProspectStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      oldStage,
      newStage,
    }: {
      prospectId: string;
      oldStage: CrmStage;
      newStage: CrmStage;
    }) => {
      const { error: updateError } = await supabase
        .from("crm_prospects")
        .update({ stage: newStage })
        .eq("id", prospectId);
      if (updateError) throw updateError;

      // Log stage change activity
      const { error: logError } = await supabase
        .from("crm_activity_log")
        .insert({
          prospect_id: prospectId,
          activity_type: "stage_change",
          title: `Stage changed to ${newStage.replace(/_/g, " ")}`,
          old_stage: oldStage,
          new_stage: newStage,
        });
      if (logError) throw logError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["crm_activity"] });
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Partial<CrmProspect> & { id: string }) => {
      const { error } = await supabase
        .from("crm_prospects")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY });
    },
  });
}

export function useAddProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      prospect: Omit<CrmProspect, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("crm_prospects")
        .insert(prospect)
        .select()
        .single();
      if (error) throw error;
      return data as CrmProspect;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROSPECTS_KEY });
    },
  });
}
