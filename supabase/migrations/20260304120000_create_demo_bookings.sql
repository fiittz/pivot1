-- Enable required extensions
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Demo bookings table for Google Calendar polling + reminder system
-- Stores demo appointments and tracks reminder email status

create table if not exists public.demo_bookings (
  id uuid primary key default gen_random_uuid(),
  invitee_name text not null,
  invitee_email text not null,
  scheduled_at timestamptz not null,
  google_event_id text unique not null,
  meeting_url text,
  reminder_24h_sent boolean not null default false,
  reminder_1h_sent boolean not null default false,
  reminder_10m_sent boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for reminder queries: find upcoming non-cancelled demos needing reminders
create index idx_demo_bookings_scheduled
  on public.demo_bookings (scheduled_at)
  where cancelled = false;

-- RLS: only service role can access this table (edge functions use service role key)
alter table public.demo_bookings enable row level security;

-- Cron job: call send-demo-reminders every 5 minutes
select cron.schedule(
  'send-demo-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ystgzxtxplhxuwsthmbj.supabase.co/functions/v1/send-demo-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.demo_reminder_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
