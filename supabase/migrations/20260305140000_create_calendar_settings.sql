-- Calendar settings: single-row config table for booking availability
CREATE TABLE public.calendar_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_hour int NOT NULL DEFAULT 9,
  end_hour int NOT NULL DEFAULT 21,
  slot_minutes int NOT NULL DEFAULT 30,
  lookahead_days int NOT NULL DEFAULT 20,
  same_day_buffer_hours int NOT NULL DEFAULT 3,
  available_days int[] NOT NULL DEFAULT '{1,2,3,4,5}',  -- 1=Mon..5=Fri
  rate_limit_per_hour int NOT NULL DEFAULT 3,
  reminder_24h_enabled boolean NOT NULL DEFAULT true,
  reminder_1h_enabled boolean NOT NULL DEFAULT true,
  reminder_10m_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- Seed the single row
INSERT INTO public.calendar_settings DEFAULT VALUES;

-- RLS
ALTER TABLE public.calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to calendar_settings"
  ON public.calendar_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow update access to calendar_settings"
  ON public.calendar_settings FOR UPDATE
  USING (true);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION public.update_calendar_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calendar_settings_updated_at
  BEFORE UPDATE ON public.calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calendar_settings_updated_at();
