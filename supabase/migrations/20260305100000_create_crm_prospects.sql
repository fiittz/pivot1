-- CRM Prospects table
CREATE TYPE crm_stage AS ENUM (
  'new_lead','contacted','call_1_booked','call_1_done',
  'demo_booked','demo_done','call_2_booked','call_2_done',
  'pilot','closed_won','closed_lost','not_a_fit'
);

CREATE TYPE crm_priority AS ENUM ('top','high','medium','low');

CREATE TABLE public.crm_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area text,
  phone text,
  email text,
  website text,
  priority crm_priority NOT NULL DEFAULT 'medium',
  stage crm_stage NOT NULL DEFAULT 'new_lead',
  comments text,
  deal_value numeric(10,2),
  call_1_date date,
  call_1_notes text,
  demo_date date,
  demo_notes text,
  call_2_date date,
  call_2_notes text,
  pilot_started date,
  closed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_crm_prospects_stage ON public.crm_prospects(stage);
CREATE INDEX idx_crm_prospects_priority ON public.crm_prospects(priority);
CREATE INDEX idx_crm_prospects_email ON public.crm_prospects(email) WHERE email IS NOT NULL AND email != '';

-- RLS: public read/write (PIN-gated admin, no auth)
ALTER TABLE public.crm_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read crm_prospects" ON public.crm_prospects FOR SELECT USING (true);
CREATE POLICY "Public insert crm_prospects" ON public.crm_prospects FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update crm_prospects" ON public.crm_prospects FOR UPDATE USING (true);
CREATE POLICY "Public delete crm_prospects" ON public.crm_prospects FOR DELETE USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_crm_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_prospects_updated_at
  BEFORE UPDATE ON public.crm_prospects
  FOR EACH ROW EXECUTE FUNCTION update_crm_prospects_updated_at();
