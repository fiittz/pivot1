-- Set up pg_cron jobs for filing deadlines and notifications
-- Uses pg_net to call edge functions

-- Ensure extensions are available
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 1. Filing deadline check — daily at 08:00 UTC
SELECT cron.schedule(
  'filing-deadline-check-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ystgzxtxplhxuwsthmbj.supabase.co/functions/v1/filing-deadline-check?secret=8534f342fbe5995aa0084d8a7a8f7cbb',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Send notifications — every 5 minutes
SELECT cron.schedule(
  'send-notifications-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ystgzxtxplhxuwsthmbj.supabase.co/functions/v1/send-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
