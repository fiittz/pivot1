-- Seed clients directly into jamie@balnce.ie's practice, bypassing invite flow.
-- Run AFTER jamie@balnce.ie has signed up and created a practice.
DO $$
DECLARE
  v_accountant_id UUID;
  v_practice_id UUID;
  v_client RECORD;
BEGIN
  -- Look up jamie@balnce.ie
  SELECT id INTO v_accountant_id
  FROM auth.users
  WHERE email = 'jamie@balnce.ie';

  IF v_accountant_id IS NULL THEN
    RAISE NOTICE 'jamie@balnce.ie not found in auth.users — run this after signup';
    RETURN;
  END IF;

  -- Look up their practice
  SELECT id INTO v_practice_id
  FROM public.accountant_practices
  WHERE owner_id = v_accountant_id
  LIMIT 1;

  IF v_practice_id IS NULL THEN
    RAISE NOTICE 'No practice found for jamie@balnce.ie — run this after practice creation';
    RETURN;
  END IF;

  -- Seed clients
  FOR v_client IN
    SELECT * FROM (VALUES
      ('jamie@oakmont.ie',              'Jamie Fitzgerald',  'Oakmont'),
      ('thomasvonteichman@nomadai.ie',  'Thomas von Teichman', 'NomadAI'),
      ('fitzgerald7071jamie@gmail.com', 'Jamie (Personal)',  NULL),
      ('kevin@workstuff.ai',            'Kevin',             'WorkStuff'),
      ('markafmoore+balnce@gmail.com',  'Mark Moore',        NULL),
      ('brendan@coso.ai',               'Brendan',           'Coso'),
      ('harshhc5@proton.me',            'Harsh',             NULL)
    ) AS t(email, name, business)
  LOOP
    -- Skip if already linked to this practice
    IF NOT EXISTS (
      SELECT 1 FROM public.accountant_clients
      WHERE practice_id = v_practice_id AND client_email = v_client.email
    ) THEN
      INSERT INTO public.accountant_clients (
        practice_id, accountant_id, client_user_id,
        client_name, client_email, client_business_name,
        status, access_level
      )
      VALUES (
        v_practice_id, v_accountant_id,
        (SELECT id FROM auth.users WHERE email = v_client.email),
        v_client.name, v_client.email, v_client.business,
        'active', 'read_write'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Seeded clients for jamie@balnce.ie';
END $$;
