import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ApprovedAccountant } from "@/types/accountant";

const QUERY_KEY = ["approved_accountants"];

export function useApprovedAccountants() {
  return useQuery<ApprovedAccountant[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approved_accountants")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ApprovedAccountant[];
    },
  });
}

export function useAddApprovedAccountant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase
        .from("approved_accountants")
        .insert({ email: email.toLowerCase().trim(), approved_by: user?.id })
        .select()
        .single();

      if (error) throw error;
      return data as ApprovedAccountant;
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
      const { error } = await supabase
        .from("approved_accountants")
        .update({ status: "revoked" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["platform_overview"] });
    },
  });
}
