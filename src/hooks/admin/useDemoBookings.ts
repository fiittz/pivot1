import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DemoBooking } from "@/types/crm";

export function useDemoBookings() {
  return useQuery<DemoBooking[]>({
    queryKey: ["demo_bookings_upcoming"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_bookings")
        .select("*")
        .eq("cancelled", false)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemoBooking[];
    },
  });
}

export function useTodaysDemos() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  return useQuery<DemoBooking[]>({
    queryKey: ["demo_bookings_today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_bookings")
        .select("*")
        .eq("cancelled", false)
        .gte("scheduled_at", startOfDay)
        .lt("scheduled_at", endOfDay)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DemoBooking[];
    },
  });
}

export function useProspectDemoBookings(email: string | null | undefined) {
  return useQuery<DemoBooking[]>({
    queryKey: ["demo_bookings_prospect", email],
    enabled: !!email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demo_bookings")
        .select("*")
        .ilike("invitee_email", email!)
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DemoBooking[];
    },
  });
}
