import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const CALENDAR_API_SECRET = Deno.env.get("CALENDAR_API_SECRET");
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

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Google OAuth not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const daysAhead = parseInt(url.searchParams.get("days") || "30", 10);

    const accessToken = await getGoogleAccessToken();
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60_000).toISOString();

    const allEvents: unknown[] = [];

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

    // Sort by start time
    allEvents.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return new Response(
      JSON.stringify({ events: allEvents, count: allEvents.length }),
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
