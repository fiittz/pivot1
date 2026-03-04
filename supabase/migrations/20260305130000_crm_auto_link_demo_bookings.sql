-- Auto-link demo bookings to CRM prospects

-- Stage ordering for comparison (only advance forward)
CREATE OR REPLACE FUNCTION crm_stage_order(s crm_stage) RETURNS int AS $$
BEGIN
  RETURN CASE s
    WHEN 'new_lead' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'call_1_booked' THEN 3
    WHEN 'call_1_done' THEN 4
    WHEN 'demo_booked' THEN 5
    WHEN 'demo_done' THEN 6
    WHEN 'call_2_booked' THEN 7
    WHEN 'call_2_done' THEN 8
    WHEN 'pilot' THEN 9
    WHEN 'closed_won' THEN 10
    WHEN 'closed_lost' THEN 11
    WHEN 'not_a_fit' THEN 12
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger 1: AFTER INSERT on demo_bookings
-- Match invitee_email to crm_prospects.email, advance stage to demo_booked, log activity
CREATE OR REPLACE FUNCTION crm_link_demo_booking() RETURNS TRIGGER AS $$
DECLARE
  v_prospect RECORD;
BEGIN
  -- Only proceed if email is not empty
  IF NEW.invitee_email IS NULL OR NEW.invitee_email = '' THEN
    RETURN NEW;
  END IF;

  -- Find matching prospect by email (case-insensitive)
  SELECT id, stage, name INTO v_prospect
  FROM public.crm_prospects
  WHERE lower(email) = lower(NEW.invitee_email)
  LIMIT 1;

  IF v_prospect.id IS NOT NULL THEN
    -- Advance stage to demo_booked only if currently in an earlier stage
    IF crm_stage_order(v_prospect.stage) < crm_stage_order('demo_booked') THEN
      UPDATE public.crm_prospects
      SET stage = 'demo_booked',
          demo_date = (NEW.scheduled_at AT TIME ZONE 'Europe/Dublin')::date
      WHERE id = v_prospect.id;

      -- Log stage change activity
      INSERT INTO public.crm_activity_log (prospect_id, activity_type, title, content, old_stage, new_stage, demo_booking_id)
      VALUES (
        v_prospect.id,
        'stage_change',
        'Stage advanced to Demo Booked',
        'Auto-linked: ' || NEW.invitee_name || ' (' || NEW.invitee_email || ') booked a demo for ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Dublin', 'DD Mon YYYY HH24:MI'),
        v_prospect.stage,
        'demo_booked',
        NEW.id
      );
    END IF;

    -- Always log the demo_booked activity
    INSERT INTO public.crm_activity_log (prospect_id, activity_type, title, content, demo_booking_id)
    VALUES (
      v_prospect.id,
      'demo_booked',
      'Demo booked',
      NEW.invitee_name || ' booked for ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Dublin', 'DD Mon YYYY HH24:MI'),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_link_demo_booking
  AFTER INSERT ON public.demo_bookings
  FOR EACH ROW EXECUTE FUNCTION crm_link_demo_booking();

-- Trigger 2: AFTER UPDATE on demo_bookings
-- When confirmed changes false→true, log demo_confirmed activity
CREATE OR REPLACE FUNCTION crm_link_demo_confirmed() RETURNS TRIGGER AS $$
DECLARE
  v_prospect_id uuid;
BEGIN
  -- Only fire when confirmed changes from false to true
  IF OLD.confirmed = false AND NEW.confirmed = true THEN
    -- Find matching prospect
    SELECT id INTO v_prospect_id
    FROM public.crm_prospects
    WHERE lower(email) = lower(NEW.invitee_email)
    LIMIT 1;

    IF v_prospect_id IS NOT NULL THEN
      INSERT INTO public.crm_activity_log (prospect_id, activity_type, title, content, demo_booking_id)
      VALUES (
        v_prospect_id,
        'demo_confirmed',
        'Demo confirmed',
        NEW.invitee_name || ' confirmed attendance for ' || to_char(NEW.scheduled_at AT TIME ZONE 'Europe/Dublin', 'DD Mon YYYY HH24:MI'),
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_crm_link_demo_confirmed
  AFTER UPDATE ON public.demo_bookings
  FOR EACH ROW EXECUTE FUNCTION crm_link_demo_confirmed();
