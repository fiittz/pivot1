import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RegisteredAccountant } from "@/types/accountant";

export function useRegisteredAccountants() {
  return useQuery<RegisteredAccountant[]>({
    queryKey: ["registered_accountants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_registered_accountants");
      if (error) throw error;
      return (data ?? []) as RegisteredAccountant[];
    },
  });
}
