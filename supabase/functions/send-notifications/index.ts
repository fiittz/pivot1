/**
 * Notification Sender — processes the notification_queue table.
 * Sends pending emails via Resend. Designed to run on a schedule (pg_cron: every 5 mins).
 *
 * Handles retries (up to max_attempts), dedup, and scheduling.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { sendEmail } from "../_shared/sendEmail.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch pending notifications that are due
    const { data: pending, error } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempt_count", 3) // Don't retry more than max_attempts
      .order("scheduled_for", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0;
    let failed = 0;

    for (const notif of pending) {
      // Increment attempt count
      await supabase
        .from("notification_queue")
        .update({ attempt_count: (notif.attempt_count ?? 0) + 1 })
        .eq("id", notif.id);

      const result = await sendEmail({
        to: notif.recipient_email,
        subject: notif.subject,
        html: notif.body_html,
      });

      if (result.success) {
        await supabase
          .from("notification_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", notif.id);
        sent++;
      } else {
        const newAttempt = (notif.attempt_count ?? 0) + 1;
        const finalFailed = newAttempt >= (notif.max_attempts ?? 3);

        await supabase
          .from("notification_queue")
          .update({
            status: finalFailed ? "failed" : "pending",
            error_message: result.error,
          })
          .eq("id", notif.id);
        failed++;
      }
    }

    console.log(`[Notifications] Processed ${pending.length}: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ ok: true, processed: pending.length, sent, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Notifications] Error:", error);
    return new Response(
      JSON.stringify({ error: "Notification sending failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
