import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Fetch invitation details by token (public, but requires auth to accept) */
export function useInviteDetails(token: string | undefined) {
  return useQuery({
    queryKey: ["invite-details", token],
    queryFn: async () => {
      if (!token) return null;

      // We need a service role call to look up by token.
      // Instead, we'll call the accept function with a GET-like query.
      // For now, we show a generic "accept" page and let the edge function validate.
      // The token is validated server-side in the accept function.
      return { token };
    },
    enabled: !!token,
  });
}

/** Accept a client invitation by token */
export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (inviteToken: string) => {
      const { data, error } = await supabase.functions.invoke("accept-client-invite", {
        body: { invite_token: inviteToken },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as { success: boolean; message: string; practice_name: string };
    },
  });
}
