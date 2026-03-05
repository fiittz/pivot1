-- Fix cron job: hardcode the secret instead of relying on current_setting
-- which may not be configured in the database.

-- Remove the old cron job
select cron.unschedule('send-demo-reminders');

-- Re-create with hardcoded secret
select cron.schedule(
  'send-demo-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ystgzxtxplhxuwsthmbj.supabase.co/functions/v1/send-demo-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer 5b5ba89e1277c79a92fb9f889bb3fdc8',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Reset reminder flags for today's demo so reminders fire on next cron run
update public.demo_bookings
  set reminder_1h_sent = false, reminder_10m_sent = false
  where scheduled_at > now()
    and cancelled = false;
