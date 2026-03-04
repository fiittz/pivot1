import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const CALENDAR_IDS = ["mybpsinfo@gmail.com", "jamie@balnce.ie"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TIMEZONE = "Europe/Dublin";

function getDublinDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
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

// ── Google Calendar FreeBusy ────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: GOOGLE_REFRESH_TOKEN!,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google OAuth token refresh failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

interface BusyPeriod {
  start: string;
  end: string;
}

async function getGoogleBusyPeriods(
  timeMin: string,
  timeMax: string,
): Promise<BusyPeriod[]> {
  const accessToken = await getGoogleAccessToken();

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: CALENDAR_IDS.map((id) => ({ id })),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Google FreeBusy API ${res.status}: ${text}`);
    return [];
  }

  const data = await res.json();
  const allBusy: BusyPeriod[] = [];

  for (const calId of CALENDAR_IDS) {
    const calBusy = data.calendars?.[calId]?.busy || [];
    allBusy.push(...calBusy);
  }

  return allBusy;
}

function isSlotBusy(
  slotStartUtc: Date,
  slotEndUtc: Date,
  busyPeriods: BusyPeriod[],
): boolean {
  for (const period of busyPeriods) {
    const busyStart = new Date(period.start);
    const busyEnd = new Date(period.end);
    // Overlaps if slot starts before busy ends AND slot ends after busy starts
    if (slotStartUtc < busyEnd && slotEndUtc > busyStart) {
      return true;
    }
  }
  return false;
}

// ── Helpers to convert Dublin local time to UTC ─────────────────────

function dublinToUtc(dateStr: string, timeStr: string): Date {
  // Parse as local Dublin time and convert to UTC
  // Create a date string that we can parse
  const naive = new Date(`${dateStr}T${timeStr}:00`);
  // Get the Dublin offset for this date
  const utcStr = naive.toLocaleString("en-US", { timeZone: "UTC" });
  const dublinStr = naive.toLocaleString("en-US", { timeZone: TIMEZONE });
  const offset = (new Date(dublinStr).getTime() - new Date(utcStr).getTime());
  return new Date(naive.getTime() - offset);
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch calendar settings from DB
    const { data: settings, error: settingsError } = await supabase
      .from("calendar_settings")
      .select("*")
      .single();

    if (settingsError || !settings) {
      console.error("Failed to load calendar settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Failed to load calendar settings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const START_HOUR = settings.start_hour;
    const END_HOUR = settings.end_hour;
    const SLOT_MINUTES = settings.slot_minutes;
    const LOOKAHEAD_DAYS = settings.lookahead_days;
    const SAME_DAY_BUFFER_HOURS = settings.same_day_buffer_hours;
    const AVAILABLE_DAYS: number[] = settings.available_days;

    const now = new Date();

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

    // Fetch Google Calendar busy periods (both calendars)
    let busyPeriods: BusyPeriod[] = [];
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
      try {
        busyPeriods = await getGoogleBusyPeriods(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
        );
        console.log(`Google FreeBusy: ${busyPeriods.length} busy periods found`);
      } catch (err) {
        console.error("Google FreeBusy error (continuing without):", err);
      }
    } else {
      console.warn("Google OAuth credentials not set — skipping calendar check");
    }

    // Generate available slots for each day
    const slots: Record<string, string[]> = {};

    for (let dayOffset = 0; dayOffset <= LOOKAHEAD_DAYS; dayOffset++) {
      const date = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
      const dayOfWeek = getDublinDay(date);

      if (!AVAILABLE_DAYS.includes(dayOfWeek)) continue;

      const dateStr = getDublinDate(date);
      const daySlots: string[] = [];

      for (let h = START_HOUR; h < END_HOUR; h++) {
        for (let m = 0; m < 60; m += SLOT_MINUTES) {
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const slotKey = `${dateStr}_${timeStr}`;

          // Skip booked slots (from demo_bookings DB)
          if (bookedSlots.has(slotKey)) continue;

          // Skip past slots + 3-hour buffer for same-day bookings
          if (dayOffset === 0) {
            const nowH = getDublinHour(now);
            const nowM = getDublinMinute(now);
            const bufferH = nowH + SAME_DAY_BUFFER_HOURS;
            const bufferM = nowM;
            if (h < bufferH || (h === bufferH && m <= bufferM)) continue;
          }

          // Skip slots that overlap with Google Calendar busy periods
          if (busyPeriods.length > 0) {
            const slotStartUtc = dublinToUtc(dateStr, timeStr);
            const slotEndUtc = new Date(slotStartUtc.getTime() + SLOT_MINUTES * 60_000);
            if (isSlotBusy(slotStartUtc, slotEndUtc, busyPeriods)) continue;
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
