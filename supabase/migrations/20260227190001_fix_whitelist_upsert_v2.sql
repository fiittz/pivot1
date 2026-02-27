-- Fix: use UPDATE-then-INSERT to avoid ON CONFLICT issues with PostgREST
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
DECLARE
  v_email TEXT := lower(trim(p_email));
BEGIN
  -- Try to reactivate existing entry first
  RETURN QUERY
  UPDATE public.approved_accountants
  SET status = 'active'
  WHERE approved_accountants.email = v_email
  RETURNING
    approved_accountants.id,
    approved_accountants.email,
    approved_accountants.approved_by,
    approved_accountants.status,
    approved_accountants.created_at;

  -- If no existing entry, insert a new one
  IF NOT FOUND THEN
    RETURN QUERY
    INSERT INTO public.approved_accountants (email)
    VALUES (v_email)
    RETURNING
      approved_accountants.id,
      approved_accountants.email,
      approved_accountants.approved_by,
      approved_accountants.status,
      approved_accountants.created_at;
  END IF;
END;
$$;
