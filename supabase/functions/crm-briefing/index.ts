import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEMO_REMINDER_SECRET = Deno.env.get("DEMO_REMINDER_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check — same secret as demo reminders
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!DEMO_REMINDER_SECRET || token !== DEMO_REMINDER_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Today's boundaries (Dublin time)
  const now = new Date();
  const dublinOffset = getDublinOffset(now);
  const dublinNow = new Date(now.getTime() + dublinOffset * 60000);
  const startOfDay = new Date(dublinNow.getFullYear(), dublinNow.getMonth(), dublinNow.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  // Convert back to UTC for queries
  const startUTC = new Date(startOfDay.getTime() - dublinOffset * 60000).toISOString();
  const endUTC = new Date(endOfDay.getTime() - dublinOffset * 60000).toISOString();

  // End of week (next 7 days)
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 86400000);
  const endOfWeekUTC = new Date(endOfWeek.getTime() - dublinOffset * 60000).toISOString();

  // 1. Today's demos
  const { data: todayDemos } = await sb
    .from("demo_bookings")
    .select("invitee_name, invitee_email, scheduled_at, confirmed, meeting_url")
    .eq("cancelled", false)
    .gte("scheduled_at", startUTC)
    .lt("scheduled_at", endUTC)
    .order("scheduled_at");

  // 2. This week's demos
  const { data: weekDemos } = await sb
    .from("demo_bookings")
    .select("confirmed")
    .eq("cancelled", false)
    .gte("scheduled_at", startUTC)
    .lt("scheduled_at", endOfWeekUTC);

  // 3. Pipeline counts by stage
  const { data: prospects } = await sb
    .from("crm_prospects")
    .select("id, name, stage, updated_at");

  const byStage: Record<string, number> = {};
  let total = 0;
  if (prospects) {
    for (const p of prospects) {
      byStage[p.stage] = (byStage[p.stage] || 0) + 1;
      total++;
    }
  }

  // 4. Prospects needing follow-up (contacted or earlier, not updated in 7+ days)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const needsFollowUp = prospects
    ?.filter((p) => {
      const stageOrder = [
        "new_lead", "contacted", "call_1_booked", "call_1_done",
        "demo_booked", "demo_done",
      ];
      return (
        stageOrder.includes(p.stage) &&
        new Date(p.updated_at) < sevenDaysAgo
      );
    })
    .map((p) => ({
      name: p.name,
      stage: p.stage,
      last_activity_days_ago: Math.floor(
        (now.getTime() - new Date(p.updated_at).getTime()) / 86400000
      ),
    }))
    .sort((a, b) => b.last_activity_days_ago - a.last_activity_days_ago)
    .slice(0, 10) ?? [];

  // 5. Recent activity (last 48h)
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
  const { data: recentActivity } = await sb
    .from("crm_activity_log")
    .select("activity_type, title, created_at, prospect_id")
    .gte("created_at", twoDaysAgo)
    .order("created_at", { ascending: false })
    .limit(20);

  // Map prospect names
  const prospectMap = new Map(prospects?.map((p) => [p.id, p.name]) ?? []);
  const activityWithNames = recentActivity?.map((a) => ({
    prospect_name: prospectMap.get(a.prospect_id) ?? "Unknown",
    type: a.activity_type,
    title: a.title,
    when: a.created_at,
  })) ?? [];

  const unconfirmedToday = todayDemos?.filter((d) => !d.confirmed).length ?? 0;

  const briefing = {
    generated_at: now.toISOString(),
    today: {
      demos: todayDemos?.map((d) => ({
        name: d.invitee_name,
        email: d.invitee_email,
        time: d.scheduled_at,
        confirmed: d.confirmed,
        meeting_url: d.meeting_url,
      })) ?? [],
      unconfirmed_count: unconfirmedToday,
    },
    this_week: {
      demos_count: weekDemos?.length ?? 0,
      confirmed_count: weekDemos?.filter((d) => d.confirmed).length ?? 0,
    },
    pipeline: {
      total,
      by_stage: byStage,
      needs_follow_up: needsFollowUp,
    },
    recent_activity: activityWithNames,
  };

  return new Response(JSON.stringify(briefing, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Dublin timezone offset (handles DST)
function getDublinOffset(date: Date): number {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  // Dublin is UTC+0 in winter, UTC+1 in summer (IST)
  // We need the offset from UTC
  const month = date.getMonth();
  const lastSunMar = new Date(date.getFullYear(), 2, 31);
  lastSunMar.setDate(lastSunMar.getDate() - lastSunMar.getDay());
  const lastSunOct = new Date(date.getFullYear(), 9, 31);
  lastSunOct.setDate(lastSunOct.getDate() - lastSunOct.getDay());

  if (date >= lastSunMar && date < lastSunOct) {
    return 60; // IST: UTC+1 = +60 minutes
  }
  return 0; // GMT: UTC+0
}
