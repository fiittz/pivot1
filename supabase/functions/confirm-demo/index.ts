import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const bookingId = url.searchParams.get("id");

    if (!bookingId) {
      return new Response(buildPage("Missing booking ID", "We couldn't find your booking. Please check the link in your email."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("demo_bookings")
      .update({ confirmed: true })
      .eq("id", bookingId)
      .select("invitee_name, scheduled_at")
      .single();

    if (error || !data) {
      console.error("Confirm error:", error);
      return new Response(buildPage("Booking not found", "We couldn't find that booking. It may have been cancelled or the link is invalid."), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const dateStr = new Date(data.scheduled_at).toLocaleString("en-IE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Dublin",
    });

    return new Response(
      buildPage(
        "You're confirmed!",
        `Thanks ${data.invitee_name} — we've confirmed your Balnce demo on <strong>${dateStr}</strong>. See you then!`,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(buildPage("Something went wrong", "Please try again or reply to your reminder email."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

function buildPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Balnce</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: #fff; border-radius: 12px; max-width: 480px; width: 100%; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .header { background: #000; padding: 24px 32px; }
    .header h1 { color: #fff; font-size: 20px; font-weight: 700; }
    .stripe { background: #F2C300; height: 4px; }
    .body { padding: 40px 32px; text-align: center; }
    .body h2 { color: #111; font-size: 22px; margin-bottom: 16px; }
    .body p { color: #555; font-size: 15px; line-height: 1.6; }
    .footer { background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center; }
    .footer p { color: #999; font-size: 12px; }
    .footer a { color: #F2C300; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>Balnce</h1></div>
    <div class="stripe"></div>
    <div class="body">
      <h2>${title}</h2>
      <p>${message}</p>
    </div>
    <div class="footer">
      <p><a href="https://balnce.ie">balnce.ie</a> &mdash; Accounting made simple</p>
    </div>
  </div>
</body>
</html>`;
}
