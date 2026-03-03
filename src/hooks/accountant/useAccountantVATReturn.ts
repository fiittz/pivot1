import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpsertVATReturnInput {
  period_start: string;
  period_end: string;
  vat_on_sales: number;
  vat_on_purchases: number;
  vat_due: number;
  vat_notes?: string;
}

export function useAccountantUpsertVATReturn(clientUserId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertVATReturnInput) => {
      if (!clientUserId) throw new Error("No client user ID");

      // Check if a record already exists for this period
      const { data: existing } = await supabase
        .from("vat_returns")
        .select("id")
        .eq("user_id", clientUserId)
        .eq("period_start", input.period_start)
        .eq("period_end", input.period_end)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("vat_returns")
          .update({
            vat_on_sales: input.vat_on_sales,
            vat_on_purchases: input.vat_on_purchases,
            vat_due: input.vat_due,
            status: "ready",
            vat_notes: input.vat_notes ?? null,
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("vat_returns")
          .insert({
            user_id: clientUserId,
            period_start: input.period_start,
            period_end: input.period_end,
            vat_on_sales: input.vat_on_sales,
            vat_on_purchases: input.vat_on_purchases,
            vat_due: input.vat_due,
            status: "ready",
            vat_notes: input.vat_notes ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-vat-returns", clientUserId] });
    },
  });
}
