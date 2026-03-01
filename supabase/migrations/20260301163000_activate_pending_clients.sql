-- Activate any pending_invite clients in jamie@balnce.ie's practice
-- and link their client_user_id from auth.users
DO $$
DECLARE
  v_accountant_id UUID;
  v_practice_id UUID;
BEGIN
  SELECT id INTO v_accountant_id
  FROM auth.users WHERE email = 'jamie@balnce.ie';

  SELECT id INTO v_practice_id
  FROM public.accountant_practices
  WHERE owner_id = v_accountant_id LIMIT 1;

  IF v_practice_id IS NULL THEN RETURN; END IF;

  -- Activate all pending invites and link user IDs
  UPDATE public.accountant_clients ac
  SET
    status = 'active',
    access_level = 'read_write',
    client_user_id = COALESCE(ac.client_user_id, (
      SELECT u.id FROM auth.users u
      WHERE LOWER(u.email) = LOWER(ac.client_email)
    )),
    updated_at = now()
  WHERE ac.practice_id = v_practice_id
    AND ac.status = 'pending_invite';

  RAISE NOTICE 'Activated all pending clients for jamie@balnce.ie';
END $$;
