import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ClientNote } from "@/types/accountant";

export function useClientNotes(accountantClientId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-notes", accountantClientId],
    queryFn: async (): Promise<ClientNote[]> => {
      const { data, error } = await supabase
        .from("client_notes")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as ClientNote[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

export function useCreateNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      title: string;
      content: string;
    }) => {
      const { data, error } = await supabase
        .from("client_notes")
        .insert({
          accountant_client_id: input.accountant_client_id,
          accountant_id: user!.id,
          title: input.title,
          content: input.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", variables.accountant_client_id] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      title?: string;
      content?: string;
      is_pinned?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.content !== undefined) updates.content = input.content;
      if (input.is_pinned !== undefined) updates.is_pinned = input.is_pinned;

      const { data, error } = await supabase
        .from("client_notes")
        .update(updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", variables.accountant_client_id] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accountant_client_id: string }) => {
      const { error } = await supabase
        .from("client_notes")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-notes", variables.accountant_client_id] });
    },
  });
}
