-- CRM Activity Log table
CREATE TYPE crm_activity_type AS ENUM (
  'note','call','email_sent','demo_booked','demo_confirmed',
  'demo_done','stage_change','follow_up','system'
);

CREATE TABLE public.crm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.crm_prospects(id) ON DELETE CASCADE,
  activity_type crm_activity_type NOT NULL,
  title text NOT NULL,
  content text,
  old_stage crm_stage,
  new_stage crm_stage,
  demo_booking_id uuid REFERENCES public.demo_bookings(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_crm_activity_prospect ON public.crm_activity_log(prospect_id);
CREATE INDEX idx_crm_activity_created ON public.crm_activity_log(created_at DESC);
CREATE INDEX idx_crm_activity_type ON public.crm_activity_log(activity_type);

-- RLS: public read/write (PIN-gated admin)
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read crm_activity_log" ON public.crm_activity_log FOR SELECT USING (true);
CREATE POLICY "Public insert crm_activity_log" ON public.crm_activity_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update crm_activity_log" ON public.crm_activity_log FOR UPDATE USING (true);
CREATE POLICY "Public delete crm_activity_log" ON public.crm_activity_log FOR DELETE USING (true);
