import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Availability: Mon–Fri, 10:00–17:00 Dublin time, 30-min slots
const START_HOUR = 10;
const END_HOUR = 17;
const SLOT_MINUTES = 30;
const LOOKAHEAD_DAYS = 14;
const TIMEZONE = "Europe/Dublin";

function getDublinDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // YYYY-MM-DD
}

function getDublinHour(date: Date): number {
  return parseInt(
    date.toLocaleString("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hour12: false }),
    10,
  );
}

function getDublinMinute(date: Date): number {
  return parseInt(
    date.toLocaleString("en-GB", { timeZone: TIMEZONE, minute: "2-digit" }),
    10,
  );
}

function getDublinDay(date: Date): number {
  const dayStr = date.toLocaleDateString("en-GB", { timeZone: TIMEZONE, weekday: "short" });
  const days: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return days[dayStr] ?? 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    // Calculate date range
    const rangeStart = new Date(now);
    const rangeEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60_000);

    // Fetch existing non-cancelled bookings in range
    const { data: bookings, error } = await supabase
      .from("demo_bookings")
      .select("scheduled_at")
      .eq("cancelled", false)
      .gte("scheduled_at", rangeStart.toISOString())
      .lte("scheduled_at", rangeEnd.toISOString());

    if (error) {
      console.error("DB error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch bookings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build set of booked slot keys: "YYYY-MM-DD_HH:MM"
    const bookedSlots = new Set<string>();
    for (const b of bookings || []) {
      const d = new Date(b.scheduled_at);
      const dateStr = getDublinDate(d);
      const h = getDublinHour(d);
      const m = getDublinMinute(d);
      bookedSlots.add(`${dateStr}_${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }

    // Generate available slots for each day
    const slots: Record<string, string[]> = {};

    for (let dayOffset = 0; dayOffset <= LOOKAHEAD_DAYS; dayOffset++) {
      const date = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
      const dayOfWeek = getDublinDay(date);

      // Skip weekends (Sat=6, Sun=0)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = getDublinDate(date);
      const daySlots: string[] = [];

      for (let h = START_HOUR; h < END_HOUR; h++) {
        for (let m = 0; m < 60; m += SLOT_MINUTES) {
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const slotKey = `${dateStr}_${timeStr}`;

          // Skip booked slots
          if (bookedSlots.has(slotKey)) continue;

          // Skip past slots (compare in Dublin time)
          if (dayOffset === 0) {
            const nowH = getDublinHour(now);
            const nowM = getDublinMinute(now);
            if (h < nowH || (h === nowH && m <= nowM)) continue;
          }

          daySlots.push(timeStr);
        }
      }

      if (daySlots.length > 0) {
        slots[dateStr] = daySlots;
      }
    }

    return new Response(
      JSON.stringify({ slots, timezone: TIMEZONE }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error in get-available-slots:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
