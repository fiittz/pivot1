INSERT INTO public.approved_emails (email, note)
VALUES ('harshhc5@proton.me', 'Harsh - Proton')
ON CONFLICT (email) DO NOTHING;
