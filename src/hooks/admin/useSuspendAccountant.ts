import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSuspendAccountant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("suspend_accountant", {
        p_email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registered_accountants"] });
      queryClient.invalidateQueries({ queryKey: ["platform_overview"] });
      queryClient.invalidateQueries({ queryKey: ["approved_accountants"] });
    },
  });
}

export function useReactivateAccountant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("reactivate_accountant", {
        p_email: email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registered_accountants"] });
      queryClient.invalidateQueries({ queryKey: ["platform_overview"] });
      queryClient.invalidateQueries({ queryKey: ["approved_accountants"] });
    },
  });
}
