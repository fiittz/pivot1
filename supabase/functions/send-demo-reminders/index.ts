import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DEMO_REMINDER_SECRET = Deno.env.get("DEMO_REMINDER_SECRET");
const CRON_SECRET = "5b5ba89e1277c79a92fb9f889bb3fdc8";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN");
const TITAN_ICAL_URL = Deno.env.get("TITAN_ICAL_URL");
const OWNER_EMAIL = "mybpsinfo@gmail.com";
const CALENDAR_IDS = [OWNER_EMAIL, "jamie@balnce.ie"];
const OWN_EMAILS = new Set(CALENDAR_IDS.map((e) => e.toLowerCase()));

// ── Types ──────────────────────────────────────────────────────────

interface DemoBooking {
  id: string;
  invitee_name: string;
  invitee_email: string;
  scheduled_at: string;
  meeting_url: string | null;
  summary: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  reminder_10m_sent: boolean;
}

type ReminderType = "24h" | "1h" | "10m";

// ── Google Calendar polling (OAuth2 refresh token) ─────────────────

interface GoogleCalendarEvent {
  id: string;
  status: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string; self?: boolean }[];
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
}

async function getGoogleAccessToken(): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: GOOGLE_REFRESH_TOKEN!,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Google OAuth token refresh failed ${tokenRes.status}: ${text}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function syncGoogleCalendarEvents(
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number; cancelled: number }> {
  const accessToken = await getGoogleAccessToken();

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString();

  let synced = 0;
  let cancelled = 0;

  for (const calId of CALENDAR_IDS) {
    const calendarId = encodeURIComponent(calId);
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events` +
      `?timeMin=${encodeURIComponent(timeMin)}` +
      `&timeMax=${encodeURIComponent(timeMax)}` +
      `&singleEvents=true&orderBy=startTime&maxResults=100` +
      `&conferenceDataVersion=1`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Google Calendar API ${res.status} for ${calId}: ${text}`);
      continue;
    }

    const data = await res.json();
    const events: GoogleCalendarEvent[] = data.items || [];

  for (const event of events) {
    // Find first external attendee (not one of our own calendars)
    const externalAttendee = event.attendees?.find(
      (a) => !OWN_EMAILS.has(a.email.toLowerCase()) && !a.self,
    );

    // Skip events with no external attendees (internal blocks, personal events)
    if (!externalAttendee) continue;

    const startTime = event.start?.dateTime || event.start?.date;
    if (!startTime) continue;

    if (event.status === "cancelled") {
      const { data } = await supabase
        .from("demo_bookings")
        .update({ cancelled: true })
        .eq("google_event_id", event.id)
        .select("id");
      if (data?.length) cancelled++;
      continue;
    }

    const inviteeName =
      externalAttendee.displayName || externalAttendee.email.split("@")[0];

    const { error } = await supabase.from("demo_bookings").upsert(
      {
        invitee_name: inviteeName,
        invitee_email: externalAttendee.email,
        scheduled_at: startTime,
        google_event_id: event.id,
        meeting_url: event.hangoutLink
          || event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri
          || null,
        summary: event.summary || null,
      },
      { onConflict: "google_event_id" },
    );

    if (error) {
      console.error("Upsert error:", error);
    } else {
      synced++;
    }
  }
  } // end calendar loop

  return { synced, cancelled };
}

// ── Titan iCal sync ─────────────────────────────────────────────────

function parseICalDate(val: string, params: string): string {
  const tzMatch = params.match(/TZID=([^:;]+)/);
  const tz = tzMatch ? tzMatch[1] : null;

  if (val.endsWith("Z")) {
    return new Date(
      val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"),
    ).toISOString();
  }

  if (val.includes("T")) {
    const iso = val.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, "$1-$2-$3T$4:$5:$6");
    if (tz) {
      const d = new Date(iso);
      const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = d.toLocaleString("en-US", { timeZone: tz });
      const offset = new Date(tzStr).getTime() - new Date(utcStr).getTime();
      return new Date(d.getTime() - offset).toISOString();
    }
    return new Date(iso).toISOString();
  }

  return val.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
}

interface TitanParsedEvent {
  uid: string;
  summary: string;
  start: string;
  attendees: { email: string; name: string | null }[];
  meetingUrl: string | null;
}

function parseTitanICal(icalText: string, now: Date, maxDate: Date): TitanParsedEvent[] {
  const events: TitanParsedEvent[] = [];
  const blocks = icalText.split("BEGIN:VEVENT");

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const unfolded = block.replace(/\r?\n[ \t]/g, "");
    const lines = unfolded.split(/\r?\n/);

    let summary = "";
    let dtstart = "";
    let dtstartParams = "";
    let uid = "";
    let meetingUrl: string | null = null;
    const attendees: { email: string; name: string | null }[] = [];

    for (const line of lines) {
      if (line.startsWith("SUMMARY:")) {
        summary = line.substring(8).trim();
      } else if (line.startsWith("DTSTART")) {
        const colonIdx = line.indexOf(":");
        dtstartParams = line.substring(0, colonIdx);
        dtstart = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith("UID:")) {
        uid = line.substring(4).trim();
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

    if (!dtstart || !uid) continue;

    try {
      const startStr = parseICalDate(dtstart, dtstartParams);
      const startDate = new Date(startStr);
      if (startDate < now || startDate > maxDate) continue;

      // Only include events with external attendees (actual demos)
      const externalAttendees = attendees.filter(
        (a) => !OWN_EMAILS.has(a.email.toLowerCase()),
      );
      if (externalAttendees.length === 0) continue;

      events.push({ uid, summary: summary || "(no title)", start: startStr, attendees: externalAttendees, meetingUrl });
    } catch {
      continue;
    }
  }

  return events;
}

async function syncTitanEvents(
  supabase: ReturnType<typeof createClient>,
): Promise<{ synced: number }> {
  if (!TITAN_ICAL_URL) return { synced: 0 };

  const icalRes = await fetch(TITAN_ICAL_URL, { redirect: "follow" });
  if (!icalRes.ok) {
    console.error(`Titan iCal fetch failed: ${icalRes.status}`);
    return { synced: 0 };
  }

  const icalText = await icalRes.text();
  const now = new Date();
  const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const events = parseTitanICal(icalText, now, maxDate);

  let synced = 0;
  for (const event of events) {
    const attendee = event.attendees[0];
    const { error } = await supabase.from("demo_bookings").upsert(
      {
        invitee_name: attendee.name || attendee.email.split("@")[0],
        invitee_email: attendee.email,
        scheduled_at: event.start,
        google_event_id: event.uid,
        meeting_url: event.meetingUrl || null,
        summary: event.summary || null,
      },
      { onConflict: "google_event_id" },
    );

    if (error) {
      console.error("Titan upsert error:", error);
    } else {
      synced++;
    }
  }

  return { synced };
}

// ── Email template ─────────────────────────────────────────────────

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Dublin",
  });
}

function buildReminderEmail(
  booking: DemoBooking,
  reminderType: ReminderType,
): { html: string; subject: string } {
  const meetingTitle = booking.summary || "your meeting with Balnce";

  const timeLabel =
    reminderType === "24h"
      ? "tomorrow"
      : reminderType === "1h"
        ? "in 1 hour"
        : "in 10 minutes";

  const subject =
    reminderType === "10m"
      ? `Starting soon — ${meetingTitle} is in 10 minutes`
      : reminderType === "1h"
        ? `Reminder — ${meetingTitle} is in 1 hour`
        : `Reminder — ${meetingTitle} is tomorrow`;

  const meetingButton = booking.meeting_url
    ? `<table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${booking.meeting_url}" style="display:inline-block;padding:14px 40px;background:#E8930C;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
                      Join Meeting
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#999;font-size:13px;line-height:1.6;">
                Or copy this link: <a href="${booking.meeting_url}" style="color:#E8930C;word-break:break-all;">${booking.meeting_url}</a>
              </p>`
    : `<p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
                We'll send you the meeting link shortly before the call.
              </p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#000000;padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Balnce</h1>
            </td>
          </tr>
          <tr>
            <td style="background:#F2C300;height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 20px;color:#111;font-size:16px;line-height:1.6;">
                Hi ${booking.invitee_name},
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
                Just a friendly reminder — <strong>${meetingTitle}</strong> is <strong>${timeLabel}</strong>.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f9fafb;border-radius:8px;border-left:3px solid #F2C300;width:100%;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#111;font-size:15px;font-weight:600;">
                      ${meetingTitle}
                    </p>
                    <p style="margin:0;color:#555;font-size:14px;">
                      ${formatDateTime(booking.scheduled_at)}
                    </p>
                  </td>
                </tr>
              </table>
              ${meetingButton}
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                <tr>
                  <td align="center" style="padding:0 4px;">
                    <a href="https://ystgzxtxplhxuwsthmbj.supabase.co/functions/v1/confirm-demo?id=${booking.id}" style="display:inline-block;padding:12px 28px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
                      Confirm Attendance
                    </a>
                  </td>
                  <td align="center" style="padding:0 4px;">
                    <a href="https://app.balnce.ie/demo" style="display:inline-block;padding:12px 28px;background:#6b7280;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
                      Reschedule
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#999;font-size:12px;text-align:center;">
                Sent via <a href="https://balnce.ie" style="color:#F2C300;text-decoration:none;font-weight:600;">Balnce</a> &mdash; Accounting made simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, subject };
}

// ── Main handler ───────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: Bearer token check (shared secret for cron)
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== CRON_SECRET && token !== DEMO_REMINDER_SECRET) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Step 1: Sync events from Google Calendar
    let syncResult = { synced: 0, cancelled: 0 };
    if (GOOGLE_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
      try {
        syncResult = await syncGoogleCalendarEvents(supabase);
        console.log(`Google Calendar sync: ${syncResult.synced} upserted, ${syncResult.cancelled} cancelled`);
      } catch (err) {
        console.error("Google Calendar sync error (continuing to reminders):", err);
      }
    } else {
      console.warn("Google OAuth credentials not set — skipping calendar sync");
    }

    // Step 1b: Sync events from Titan iCal
    let titanSyncResult = { synced: 0 };
    try {
      titanSyncResult = await syncTitanEvents(supabase);
      console.log(`Titan iCal sync: ${titanSyncResult.synced} upserted`);
    } catch (err) {
      console.error("Titan iCal sync error (continuing to reminders):", err);
    }

    // Step 2: Fetch calendar settings for reminder toggles
    const { data: calSettings } = await supabase
      .from("calendar_settings")
      .select("reminder_24h_enabled, reminder_1h_enabled, reminder_10m_enabled")
      .single();

    const reminderToggles: Record<string, boolean> = {
      "24h": calSettings?.reminder_24h_enabled ?? true,
      "1h": calSettings?.reminder_1h_enabled ?? true,
      "10m": calSettings?.reminder_10m_enabled ?? true,
    };

    // Step 3: Send reminders
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date();
    const results: { type: ReminderType; email: string; success: boolean }[] = [];

    // Define reminder windows (5-minute tolerance around target time)
    const windows: { type: ReminderType; minMs: number; maxMs: number; sentCol: string }[] = [
      { type: "24h", minMs: 23 * 60 + 45, maxMs: 24 * 60 + 15, sentCol: "reminder_24h_sent" },
      { type: "1h", minMs: 45, maxMs: 75, sentCol: "reminder_1h_sent" },
      { type: "10m", minMs: 3, maxMs: 20, sentCol: "reminder_10m_sent" },
    ];

    for (const w of windows) {
      // Skip this reminder type if disabled in settings
      if (!reminderToggles[w.type]) {
        console.log(`Skipping ${w.type} reminders (disabled in settings)`);
        continue;
      }

      const windowStart = new Date(now.getTime() + w.minMs * 60_000).toISOString();
      const windowEnd = new Date(now.getTime() + w.maxMs * 60_000).toISOString();

      const { data: bookings, error } = await supabase
        .from("demo_bookings")
        .select("id, invitee_name, invitee_email, scheduled_at, meeting_url, summary, reminder_24h_sent, reminder_1h_sent, reminder_10m_sent")
        .eq("cancelled", false)
        .eq(w.sentCol, false)
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd);

      if (error) {
        console.error(`Error querying ${w.type} reminders:`, error);
        continue;
      }

      if (!bookings || bookings.length === 0) continue;

      for (const booking of bookings as DemoBooking[]) {
        const { html, subject } = buildReminderEmail(booking, w.type);

        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Jamie from Balnce <jamie@balnce.ie>",
            reply_to: "jamie@balnce.ie",
            to: [booking.invitee_email],
            subject,
            html,
          }),
        });

        if (resendResponse.ok) {
          await supabase
            .from("demo_bookings")
            .update({ [w.sentCol]: true })
            .eq("id", booking.id);

          results.push({ type: w.type, email: booking.invitee_email, success: true });
          console.log(`Sent ${w.type} reminder to ${booking.invitee_email}`);
        } else {
          const err = await resendResponse.text();
          console.error(`Resend error for ${booking.invitee_email}:`, resendResponse.status, err);
          results.push({ type: w.type, email: booking.invitee_email, success: false });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync: { google: syncResult, titan: titanSyncResult },
        reminders_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-demo-reminders:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
