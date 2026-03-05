-- When an accountant invites a client, auto-add their email to approved_emails
-- so the client can sign up (enforce_email_whitelist trigger requires it).

CREATE OR REPLACE FUNCTION public.sync_client_invite_to_approved_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.approved_emails (email, note)
  VALUES (lower(NEW.invite_email), 'Invited by accountant')
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_client_invite_email
  AFTER INSERT ON public.client_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_invite_to_approved_emails();

-- Backfill: add any existing invited client emails that are missing
INSERT INTO public.approved_emails (email, note)
SELECT DISTINCT lower(ci.invite_email), 'Invited by accountant (backfill)'
FROM public.client_invitations ci
WHERE NOT EXISTS (
  SELECT 1 FROM public.approved_emails ae
  WHERE lower(ae.email) = lower(ci.invite_email)
);
