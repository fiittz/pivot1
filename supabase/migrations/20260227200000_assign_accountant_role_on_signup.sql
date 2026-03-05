-- Fix: Auto-assign 'accountant' role on signup if email is in approved_accountants
-- Previously only 'owner' was assigned, so whitelisted accountants couldn't log in.

-- ============================================================
-- 1. UPDATE TRIGGER: assign_owner_role → also assigns accountant if whitelisted
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Always assign 'owner' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Also assign 'accountant' role if email is in approved_accountants
  IF EXISTS (
    SELECT 1 FROM public.approved_accountants
    WHERE lower(email) = lower(NEW.email)
      AND status = 'active'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'accountant')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. BACKFILL: assign 'accountant' role to existing users on the whitelist
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'accountant'::user_role_type
FROM auth.users u
INNER JOIN public.approved_accountants aa
  ON lower(u.email) = lower(aa.email)
  AND aa.status = 'active'
ON CONFLICT (user_id, role) DO NOTHING;
