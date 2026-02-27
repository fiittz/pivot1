-- Fix: handle duplicate emails with ON CONFLICT upsert
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
