-- Add jamie@balnce.ie as approved email + approved accountant
INSERT INTO public.approved_emails (email, note)
VALUES ('jamie@balnce.ie', 'Balnce accountant - Jamie')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.approved_accountants (email, status)
VALUES ('jamie@balnce.ie', 'active')
ON CONFLICT (email) DO UPDATE SET status = 'active';
