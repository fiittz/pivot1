import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface DirectMessage {
  id: string;
  accountant_client_id: string;
  sender_id: string;
  sender_role: "accountant" | "client";
  content: string;
  is_read: boolean;
  created_at: string;
}

export function useDirectMessages(accountantClientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["direct-messages", accountantClientId],
    queryFn: async (): Promise<DirectMessage[]> => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as DirectMessage[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

export function useSendDirectMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      content: string;
      sender_role: "accountant" | "client";
    }) => {
      const { data, error } = await supabase
        .from("direct_messages")
        .insert({
          accountant_client_id: input.accountant_client_id,
          sender_id: user!.id,
          sender_role: input.sender_role,
          content: input.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["direct-messages", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    },
  });
}

export function useMarkMessagesRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { accountant_client_id: string }) => {
      const { error } = await supabase
        .from("direct_messages")
        .update({ is_read: true })
        .eq("accountant_client_id", input.accountant_client_id)
        .eq("is_read", false)
        .neq("sender_id", user!.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["direct-messages", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    },
  });
}

export function useUnreadMessageCount(accountantClientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-messages", accountantClientId],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("direct_messages")
        .select("*", { count: "exact", head: true })
        .eq("accountant_client_id", accountantClientId!)
        .eq("is_read", false)
        .neq("sender_id", user!.id);

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user && !!accountantClientId,
  });
}
