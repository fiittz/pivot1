-- Practice Management: suspended status + admin RPCs
-- accountant_clients table already created in 110000

-- 1. Update approved_accountants CHECK constraint to include 'suspended'
ALTER TABLE public.approved_accountants
  DROP CONSTRAINT IF EXISTS approved_accountants_status_check;

ALTER TABLE public.approved_accountants
  ADD CONSTRAINT approved_accountants_status_check
  CHECK (status IN ('active', 'revoked', 'suspended'));

-- 2. Add platform admin RLS policies to existing accountant_clients table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accountant_clients' AND policyname = 'Platform admins can view all accountant_clients'
  ) THEN
    EXECUTE 'CREATE POLICY "Platform admins can view all accountant_clients" ON public.accountant_clients FOR SELECT USING (public.is_platform_admin())';
  END IF;
END $$;

-- 3. get_registered_accountants() RPC
CREATE OR REPLACE FUNCTION public.get_registered_accountants()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  signed_up_at TIMESTAMPTZ,
  status TEXT,
  client_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ur.user_id,
    au.email::TEXT,
    COALESCE(p.business_name, split_part(au.email::TEXT, '@', 1)) AS display_name,
    au.created_at AS signed_up_at,
    COALESCE(aa.status, 'active') AS status,
    (SELECT count(*) FROM public.accountant_clients ac WHERE ac.accountant_id = ur.user_id) AS client_count
  FROM public.user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  LEFT JOIN public.approved_accountants aa ON lower(aa.email) = lower(au.email::TEXT)
  WHERE ur.role = 'accountant'
  ORDER BY au.created_at DESC;
$$;

-- 4. get_platform_overview() RPC
CREATE OR REPLACE FUNCTION public.get_platform_overview()
RETURNS TABLE (
  total_users BIGINT,
  active_accountants BIGINT,
  suspended_accountants BIGINT,
  whitelisted_emails BIGINT,
  total_transactions BIGINT,
  businesses_with_transactions BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM auth.users) AS total_users,
    (SELECT count(*) FROM public.user_roles WHERE role = 'accountant') AS active_accountants,
    (SELECT count(*) FROM public.approved_accountants WHERE status = 'suspended') AS suspended_accountants,
    (SELECT count(*) FROM public.approved_accountants WHERE status = 'active') AS whitelisted_emails,
    (SELECT count(*) FROM public.transactions) AS total_transactions,
    (SELECT count(DISTINCT user_id) FROM public.transactions) AS businesses_with_transactions;
$$;

-- 5. get_accountant_clients(p_accountant_id) RPC
-- Uses client_user_id from existing accountant_clients table schema
CREATE OR REPLACE FUNCTION public.get_accountant_clients(p_accountant_id UUID)
RETURNS TABLE (
  client_id UUID,
  email TEXT,
  business_name TEXT,
  signed_up_at TIMESTAMPTZ,
  transaction_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ac.client_user_id AS client_id,
    au.email::TEXT,
    p.business_name,
    au.created_at AS signed_up_at,
    (SELECT count(*) FROM public.transactions t WHERE t.user_id = ac.client_user_id) AS transaction_count
  FROM public.accountant_clients ac
  JOIN auth.users au ON au.id = ac.client_user_id
  LEFT JOIN public.profiles p ON p.id = ac.client_user_id
  WHERE ac.accountant_id = p_accountant_id
    AND ac.client_user_id IS NOT NULL
  ORDER BY au.created_at DESC;
$$;

-- 6. suspend_accountant(p_email) RPC
CREATE OR REPLACE FUNCTION public.suspend_accountant(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Update whitelist status
  UPDATE public.approved_accountants
  SET status = 'suspended'
  WHERE lower(email) = lower(p_email);

  -- Find user and remove accountant role
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email::TEXT) = lower(p_email) LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'accountant';
  END IF;
END;
$$;

-- 7. reactivate_accountant(p_email) RPC
CREATE OR REPLACE FUNCTION public.reactivate_accountant(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Update whitelist status
  UPDATE public.approved_accountants
  SET status = 'active'
  WHERE lower(email) = lower(p_email);

  -- Find user and re-insert accountant role
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email::TEXT) = lower(p_email) LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'accountant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;
