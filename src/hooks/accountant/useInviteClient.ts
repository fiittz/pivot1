import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface InviteClientInput {
  client_name: string;
  client_email: string;
  client_business_name?: string;
  client_phone?: string;
  message?: string;
}

export function useInviteClient() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteClientInput) => {
      const { data, error } = await supabase.functions.invoke("send-client-invite", {
        body: input,
      });

      if (error) throw error;

      // Edge function may return error in the response body
      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate client list queries so they refetch
      queryClient.invalidateQueries({ queryKey: ["accountant-clients", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["accountant-client-counts", user?.id] });
    },
  });
}
