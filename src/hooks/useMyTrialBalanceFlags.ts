import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { TBFlag } from "@/hooks/accountant/useTrialBalance";

/**
 * Client-side: load open TB flags that need the client's response.
 */
export function useMyTrialBalanceFlags() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-tb-flags", user?.id],
    queryFn: async (): Promise<TBFlag[]> => {
      const { data, error } = await supabase
        .from("trial_balance_flags")
        .select("*")
        .eq("client_user_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as TBFlag[];
    },
    enabled: !!user,
  });
}

/**
 * Client-side: respond to a TB flag.
 */
export function useRespondToTBFlag() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { flagId: string; response: string }) => {
      const { error } = await supabase
        .from("trial_balance_flags")
        .update({
          client_response: input.response,
          status: "responded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.flagId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-tb-flags"] });
      toast.success("Response sent to your accountant");
    },
    onError: () => {
      toast.error("Failed to send response");
    },
  });
}
