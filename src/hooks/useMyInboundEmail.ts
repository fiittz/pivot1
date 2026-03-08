import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Client-facing hook — returns the unique inbound email address
 * for this user (if they're linked to an accountant).
 */
export function useMyInboundEmail() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-inbound-email", user?.id],
    queryFn: async (): Promise<string | null> => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("accountant_clients")
        .select("client_name, inbound_email_code")
        .eq("client_user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (error || !data?.inbound_email_code) return null;

      const slug = (data.client_name || "client")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/(?:^-|-$)/g, "");

      return `${slug}-${data.inbound_email_code}@in.balnce.ie`;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
