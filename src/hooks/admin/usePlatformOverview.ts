import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlatformOverview } from "@/types/accountant";

export function usePlatformOverview() {
  return useQuery<PlatformOverview>({
    queryKey: ["platform_overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_platform_overview");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error("No overview data returned");
      return row as PlatformOverview;
    },
  });
}
