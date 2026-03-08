import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ChecklistItem {
  id: string;
  accountant_client_id: string;
  item_key: string;
  label: string;
  category: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export function useOnboardingChecklist(accountantClientId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["onboarding-checklist", accountantClientId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ChecklistItem[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

export function useToggleChecklistItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      is_completed: boolean;
    }) => {
      const updates: Record<string, unknown> = {
        is_completed: input.is_completed,
        completed_at: input.is_completed ? new Date().toISOString() : null,
        completed_by: input.is_completed ? user!.id : null,
      };

      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .update(updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-checklist", variables.accountant_client_id],
      });
    },
  });
}

export function useAddChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      label: string;
      category: string;
      sort_order?: number;
    }) => {
      // Generate a unique item_key from label
      const itemKey = `custom_${input.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")}_${Date.now()}`;

      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .insert({
          accountant_client_id: input.accountant_client_id,
          item_key: itemKey,
          label: input.label,
          category: input.category,
          sort_order: input.sort_order ?? 99,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-checklist", variables.accountant_client_id],
      });
    },
  });
}

export function useUpdateChecklistNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      notes: string;
    }) => {
      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .update({ notes: input.notes })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["onboarding-checklist", variables.accountant_client_id],
      });
    },
  });
}
