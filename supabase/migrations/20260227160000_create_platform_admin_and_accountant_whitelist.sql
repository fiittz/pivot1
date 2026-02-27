-- Platform Admin + Accountant Whitelist
-- Adds platform_admin role to existing enum, approved_accountants gate, and sync trigger

-- 1. Create approved_accountants table (enum value added in prior migration)
CREATE TABLE IF NOT EXISTS public.approved_accountants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approved_accountants ENABLE ROW LEVEL SECURITY;

-- 3. is_platform_admin() helper function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'platform_admin'
  );
$$;

-- 4. RLS policies for approved_accountants
CREATE POLICY "Platform admins can select approved_accountants"
  ON public.approved_accountants FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can insert approved_accountants"
  ON public.approved_accountants FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins can update approved_accountants"
  ON public.approved_accountants FOR UPDATE
  USING (public.is_platform_admin());

CREATE POLICY "Platform admins can delete approved_accountants"
  ON public.approved_accountants FOR DELETE
  USING (public.is_platform_admin());

-- Any authenticated user can check if their own email is approved
CREATE POLICY "Users can check own email approval"
  ON public.approved_accountants FOR SELECT
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- 5. Seed Jamie's accounts as platform_admin
-- Uses EXECUTE to defer enum literal resolution past ADD VALUE transaction
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- jamie@oakmont.ie
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'jamie@oakmont.ie' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'platform_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- fitzgerald7071jamie@gmail.com
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = 'fitzgerald7071jamie@gmail.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'platform_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- 6. Sync trigger: auto-insert into approved_emails when adding to approved_accountants
CREATE OR REPLACE FUNCTION public.sync_approved_accountant_to_emails()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.approved_emails (email, note)
  VALUES (lower(NEW.email), 'Auto-added via approved_accountants')
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_accountant_email
  AFTER INSERT ON public.approved_accountants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_approved_accountant_to_emails();
