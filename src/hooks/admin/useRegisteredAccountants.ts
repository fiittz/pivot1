import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RegisteredAccountant } from "@/types/accountant";

export function useRegisteredAccountants() {
  const { user } = useAuth();

  return useQuery<RegisteredAccountant[]>({
    queryKey: ["registered_accountants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_registered_accountants");
      if (error) throw error;
      return (data ?? []) as RegisteredAccountant[];
    },
    enabled: !!user,
  });
}
