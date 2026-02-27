import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AdminClientView } from "@/types/accountant";

export function useAccountantClients(accountantId: string | null) {
  return useQuery<AdminClientView[]>({
    queryKey: ["accountant_clients", accountantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accountant_clients", {
        p_accountant_id: accountantId!,
      });
      if (error) throw error;
      return (data ?? []) as AdminClientView[];
    },
    enabled: !!accountantId,
  });
}
