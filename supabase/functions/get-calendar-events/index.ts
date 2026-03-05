import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const CALENDAR_API_SECRET = Deno.env.get("CALENDAR_API_SECRET");
const TITAN_ICAL_URL = Deno.env.get("TITAN_ICAL_URL");
const CALENDAR_IDS = ["mybpsinfo@gmail.com", "jamie@balnce.ie"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

// ── iCal parser ─────────────────────────────────────────────────────

interface ICalEvent {
  summary: string;
  start: string;
  end: string;
  attendees: { email: string; name: string | null }[];
  meetingUrl: string | null;
  location: string | null;
  uid: string;
}

function parseICalDate(val: string, params: string): string {
  // Handle TZID parameter: DTSTART;TZID=Europe/London:20260309T120000
  const tzMatch = params.match(/TZID=([^:;]+)/);
  const tz = tzMatch ? tzMatch[1] : null;

  if (val.endsWith("Z")) {
    // Already UTC
    return new Date(
      val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"),
    ).toISOString();
  }

  if (val.includes("T")) {
    const iso = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
    if (tz) {
      // Convert from timezone to UTC using Intl
      const d = new Date(iso);
      const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = d.toLocaleString("en-US", { timeZone: tz });
      const offset = new Date(tzStr).getTime() - new Date(utcStr).getTime();
      return new Date(d.getTime() - offset).toISOString();
    }
    return new Date(iso).toISOString();
  }

  // Date only: VALUE=DATE:20260309
  const dateIso = val.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  return dateIso;
}

function parseICal(icalText: string, now: Date, maxDate: Date): ICalEvent[] {
  const events: ICalEvent[] = [];
  const blocks = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    // Unfold lines (RFC 5545: lines starting with space/tab are continuations)
    const unfolded = block.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);

    let summary = "";
    let dtstart = "";
    let dtstartParams = "";
    let dtend = "";
    let dtendParams = "";
    let uid = "";
    let location = "";
    let meetingUrl: string | null = null;
    const attendees: { email: string; name: string | null }[] = [];

    for (const line of lines) {
      if (line.startsWith("SUMMARY:")) {
        summary = line.substring(8).trim();
      } else if (line.startsWith("DTSTART")) {
        const colonIdx = line.indexOf(":");
        dtstartParams = line.substring(0, colonIdx);
        dtstart = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith("DTEND")) {
        const colonIdx = line.indexOf(":");
        dtendParams = line.substring(0, colonIdx);
        dtend = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith("UID:")) {
        uid = line.substring(4).trim();
      } else if (line.startsWith("LOCATION:")) {
        location = line.substring(9).trim();
      } else if (line.startsWith("X-TITAN-MEET:")) {
        meetingUrl = line.substring(13).trim();
      } else if (line.startsWith("ATTENDEE")) {
        const emailMatch = line.match(/mailto:([^\s;]+)/i);
        const cnMatch = line.match(/CN=([^;:]+)/);
        if (emailMatch) {
          attendees.push({
            email: emailMatch[1],
            name: cnMatch ? cnMatch[1].trim() : null,
          });
        }
      }
    }

    if (!dtstart) continue;

    try {
      const startStr = parseICalDate(dtstart, dtstartParams);
      const endStr = dtend ? parseICalDate(dtend, dtendParams) : startStr;
      const startDate = new Date(startStr);

      // Filter: only future events within range
      if (startDate < now || startDate > maxDate) continue;

      events.push({
        summary: summary || "(no title)",
        start: startStr,
        end: endStr,
        attendees: attendees.filter((a) => a.email !== "jamie@balnce.ie"),
        meetingUrl,
        location: location || null,
        uid,
      });
    } catch {
      continue;
    }
  }

  return events;
}

// ── Main handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: secret via header or query param
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization");
    const headerToken = authHeader?.replace("Bearer ", "");
    const queryToken = url.searchParams.get("secret");
    const token = queryToken || headerToken;
    if (!CALENDAR_API_SECRET || token !== CALENDAR_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const daysAhead = parseInt(url.searchParams.get("days") || "30", 10);
    const now = new Date();
    const maxDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60_000);
    const allEvents: unknown[] = [];

    // 1. Google Calendar events
    if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
      try {
        const accessToken = await getGoogleAccessToken();
        const timeMin = now.toISOString();
        const timeMax = maxDate.toISOString();

        for (const calId of CALENDAR_IDS) {
          const calendarId = encodeURIComponent(calId);
          const eventsUrl =
            `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events` +
            `?timeMin=${encodeURIComponent(timeMin)}` +
            `&timeMax=${encodeURIComponent(timeMax)}` +
            `&singleEvents=true&orderBy=startTime&maxResults=100`;

          const res = await fetch(eventsUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });

          if (!res.ok) {
            console.error(`Calendar API ${res.status} for ${calId}`);
            continue;
          }

          const data = await res.json();
          for (const event of data.items || []) {
            if (event.status === "cancelled") continue;
            allEvents.push({
              id: event.id,
              calendar: calId,
              source: "google",
              summary: event.summary || "(no title)",
              start: event.start?.dateTime || event.start?.date,
              end: event.end?.dateTime || event.end?.date,
              attendees: (event.attendees || []).map((a: { email: string; displayName?: string; responseStatus?: string }) => ({
                email: a.email,
                name: a.displayName || null,
                status: a.responseStatus || null,
              })),
              meetingUrl: event.hangoutLink || null,
              location: event.location || null,
            });
          }
        }
      } catch (err) {
        console.error("Google Calendar error:", err);
      }
    }

    // 2. Titan iCal events
    if (TITAN_ICAL_URL) {
      try {
        const icalRes = await fetch(TITAN_ICAL_URL, { redirect: "follow" });
        if (icalRes.ok) {
          const icalText = await icalRes.text();
          const titanEvents = parseICal(icalText, now, maxDate);
          for (const e of titanEvents) {
            allEvents.push({
              id: e.uid,
              calendar: "jamie@balnce.ie",
              source: "titan",
              summary: e.summary,
              start: e.start,
              end: e.end,
              attendees: e.attendees,
              meetingUrl: e.meetingUrl,
              location: e.location,
            });
          }
          console.log(`Titan iCal: ${titanEvents.length} upcoming events`);
        } else {
          console.error(`Titan iCal fetch failed: ${icalRes.status}`);
        }
      } catch (err) {
        console.error("Titan iCal error:", err);
      }
    }

    // Deduplicate: if same summary+start exists in both Google and Titan, keep Titan (has attendee details)
    const seen = new Map<string, number>();
    for (let i = 0; i < allEvents.length; i++) {
      const e = allEvents[i] as any;
      const key = `${e.summary?.trim().toLowerCase()}|${new Date(e.start).getTime()}`;
      if (seen.has(key)) {
        const prevIdx = seen.get(key)!;
        const prev = allEvents[prevIdx] as any;
        // Keep the one with more attendees
        if ((e.attendees?.length || 0) > (prev.attendees?.length || 0)) {
          allEvents[prevIdx] = null as any;
          seen.set(key, i);
        } else {
          allEvents[i] = null as any;
        }
      } else {
        seen.set(key, i);
      }
    }

    const dedupedEvents = allEvents.filter(Boolean);

    // Sort by start time
    dedupedEvents.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return new Response(
      JSON.stringify({ events: dedupedEvents, count: dedupedEvents.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error in get-calendar-events:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
