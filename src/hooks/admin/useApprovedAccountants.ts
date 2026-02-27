import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ApprovedAccountant } from "@/types/accountant";

const QUERY_KEY = ["approved_accountants"];

export function useApprovedAccountants() {
  return useQuery<ApprovedAccountant[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_approved_accountants");
      if (error) throw error;
      return (data ?? []) as ApprovedAccountant[];
    },
  });
}

export function useAddApprovedAccountant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc("admin_add_approved_accountant", {
        p_email: email,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as ApprovedAccountant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["platform_overview"] });
    },
  });
}

export function useRemoveApprovedAccountant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_revoke_approved_accountant", {
        p_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["platform_overview"] });
    },
  });
}
