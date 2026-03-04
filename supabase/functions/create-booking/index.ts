import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Availability rules (must match get-available-slots)
const START_HOUR = 10;
const END_HOUR = 17;
const SLOT_MINUTES = 30;
const TIMEZONE = "Europe/Dublin";

function getDublinDay(date: Date): number {
  const dayStr = date.toLocaleDateString("en-GB", { timeZone: TIMEZONE, weekday: "short" });
  const days: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  return days[dayStr] ?? 0;
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

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("en-IE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function buildConfirmationEmail(name: string, scheduledAt: string, meetingUrl: string): string {
  const dateStr = formatDateTime(scheduledAt);
  return `<!DOCTYPE html>
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
                Hi ${name},
              </p>
              <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.6;">
                Your Balnce demo has been booked! Here are the details:
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f9fafb;border-radius:8px;border-left:3px solid #F2C300;width:100%;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#111;font-size:15px;font-weight:600;">
                      Balnce Demo
                    </p>
                    <p style="margin:0;color:#555;font-size:14px;">
                      ${dateStr}
                    </p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${meetingUrl}" style="display:inline-block;padding:14px 40px;background:#E8930C;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">
                      Join Meeting
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#999;font-size:13px;line-height:1.6;">
                Or copy this link: <a href="${meetingUrl}" style="color:#E8930C;word-break:break-all;">${meetingUrl}</a>
              </p>
              <p style="margin:20px 0 0;color:#333;font-size:15px;line-height:1.6;">
                We'll send you reminders before the call. If you need to reschedule, visit <a href="https://app.balnce.ie/demo" style="color:#E8930C;font-weight:600;">app.balnce.ie/demo</a>.
              </p>
              <p style="margin:16px 0 0;color:#333;font-size:15px;line-height:1.6;">
                Looking forward to meeting you!<br>
                <strong>Jamie</strong>, Balnce
              </p>
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
}

function buildIcsCalendarInvite(
  bookingId: string,
  name: string,
  email: string,
  scheduledAt: string,
  meetingUrl: string,
): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + 30 * 60_000);

  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const now = fmt(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Balnce//Demo Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${bookingId}@balnce.ie`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Balnce Demo — ${name}`,
    `DESCRIPTION:Demo with ${name} (${email})\\nJoin: ${meetingUrl}`,
    `URL:${meetingUrl}`,
    `ORGANIZER;CN=Jamie Fitzgerald:mailto:jamie@balnce.ie`,
    `ATTENDEE;CN=${name}:mailto:${email}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { name, email, scheduled_at } = await req.json();

    // Validate inputs
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!scheduled_at) {
      return new Response(
        JSON.stringify({ error: "Scheduled time is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return new Response(
        JSON.stringify({ error: "Invalid date format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate slot is within availability rules
    const dayOfWeek = getDublinDay(scheduledDate);
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ error: "Bookings are only available Monday to Friday" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const hour = getDublinHour(scheduledDate);
    const minute = getDublinMinute(scheduledDate);
    if (hour < START_HOUR || hour >= END_HOUR) {
      return new Response(
        JSON.stringify({ error: "Slot is outside business hours (10:00–17:00)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (minute % SLOT_MINUTES !== 0) {
      return new Response(
        JSON.stringify({ error: "Slots must be on 30-minute boundaries" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Must be in the future
    if (scheduledDate <= new Date()) {
      return new Response(
        JSON.stringify({ error: "Cannot book a slot in the past" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Rate limit: max 3 bookings per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count, error: countError } = await supabase
      .from("demo_bookings")
      .select("id", { count: "exact", head: true })
      .eq("invitee_email", email.toLowerCase())
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
    } else if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many bookings. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check slot not already booked
    // Use a 1-minute window around the exact time to catch the same slot
    const slotStart = new Date(scheduledDate.getTime() - 60_000).toISOString();
    const slotEnd = new Date(scheduledDate.getTime() + 60_000).toISOString();

    const { data: existing } = await supabase
      .from("demo_bookings")
      .select("id")
      .eq("cancelled", false)
      .gte("scheduled_at", slotStart)
      .lte("scheduled_at", slotEnd)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: "This slot is no longer available. Please choose another time." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate Jitsi meeting link
    const roomId = crypto.randomUUID().slice(0, 8);
    const meetingUrl = `https://meet.jit.si/balnce-demo-${roomId}`;

    // Insert booking
    const { data: booking, error: insertError } = await supabase
      .from("demo_bookings")
      .insert({
        invitee_name: name.trim(),
        invitee_email: email.toLowerCase().trim(),
        scheduled_at: scheduledDate.toISOString(),
        google_event_id: null,
        meeting_url: meetingUrl,
        summary: "Balnce Demo",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send emails via Resend
    if (RESEND_API_KEY) {
      const isoStr = scheduledDate.toISOString();
      const trimmedName = name.trim();
      const trimmedEmail = email.toLowerCase().trim();

      // 1. Confirmation email to prospect (with meeting link)
      try {
        const html = buildConfirmationEmail(trimmedName, isoStr, meetingUrl);
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Jamie from Balnce <jamie@balnce.ie>",
            reply_to: "jamie@balnce.ie",
            to: [trimmedEmail],
            subject: `Your Balnce demo is booked — ${formatDateTime(isoStr)}`,
            html,
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error("Resend error (prospect):", resendRes.status, errText);
        } else {
          console.log(`Confirmation email sent to ${trimmedEmail}`);
        }
      } catch (emailErr) {
        console.error("Email send error (prospect):", emailErr);
      }

      // 2. Calendar invite (.ics) to Jamie via Titan
      try {
        const icsContent = buildIcsCalendarInvite(
          booking.id,
          trimmedName,
          trimmedEmail,
          isoStr,
          meetingUrl,
        );
        const icsBase64 = btoa(icsContent);

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Balnce Bookings <jamie@balnce.ie>",
            to: ["jamie@balnce.ie"],
            subject: `New demo booked: ${trimmedName} — ${formatDateTime(isoStr)}`,
            html: `<p><strong>${trimmedName}</strong> (${trimmedEmail}) booked a Balnce demo.</p>
<p><strong>When:</strong> ${formatDateTime(isoStr)}</p>
<p><strong>Meeting:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>`,
            attachments: [
              {
                filename: "invite.ics",
                content: icsBase64,
                content_type: "text/calendar; method=PUBLISH",
              },
            ],
          }),
        });

        if (!resendRes.ok) {
          const errText = await resendRes.text();
          console.error("Resend error (ics):", resendRes.status, errText);
        } else {
          console.log(`Calendar invite sent to jamie@balnce.ie`);
        }
      } catch (icsErr) {
        console.error("ICS email error:", icsErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, bookingId: booking.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error in create-booking:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
