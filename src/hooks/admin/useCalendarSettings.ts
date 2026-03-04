import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarSettings } from "@/types/crm";

export function useCalendarSettings() {
  return useQuery<CalendarSettings>({
    queryKey: ["calendar_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data as CalendarSettings;
    },
  });
}

export function useUpdateCalendarSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<CalendarSettings, "id" | "updated_at">>) => {
      const { data, error } = await supabase
        .from("calendar_settings")
        .update(updates)
        .eq("id", 1)
        .select()
        .single();
      if (error) throw error;
      return data as CalendarSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar_settings"] });
    },
  });
}
