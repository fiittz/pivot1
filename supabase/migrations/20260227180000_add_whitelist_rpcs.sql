-- Admin whitelist RPCs (SECURITY DEFINER to bypass RLS without login)

CREATE OR REPLACE FUNCTION public.admin_add_approved_accountant(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  approved_by UUID,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.approved_accountants (email)
  VALUES (lower(trim(p_email)))
  ON CONFLICT (email) DO UPDATE
    SET status = 'active'
  RETURNING
    approved_accountants.id,
    approved_accountants.email,
    approved_accountants.approved_by,
    approved_accountants.status,
    approved_accountants.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_approved_accountant(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.approved_accountants
  SET status = 'revoked'
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_approved_accountants()
RETURNS TABLE (
  id UUID,
  email TEXT,
  approved_by UUID,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, email, approved_by, status, created_at
  FROM public.approved_accountants
  WHERE status = 'active'
  ORDER BY created_at DESC;
$$;
