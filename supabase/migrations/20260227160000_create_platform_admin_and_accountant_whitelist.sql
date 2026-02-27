-- Platform Admin + Accountant Whitelist
-- Adds platform_admin role, approved_accountants gate, and sync trigger

-- 1. Create user_role_type enum with initial values
CREATE TYPE public.user_role_type AS ENUM ('accountant', 'platform_admin');

-- 2. Create user_roles table (tracks which roles each user has)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own roles (gated by approved_accountants check in app)
CREATE POLICY "Users can insert own roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Create approved_accountants table
CREATE TABLE public.approved_accountants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  approved_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.approved_accountants ENABLE ROW LEVEL SECURITY;

-- 4. is_platform_admin() helper function
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

-- 5. RLS policies for approved_accountants
-- Platform admins get full CRUD
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

-- 6. Seed Jamie's accounts as platform_admin
-- We need to insert roles for Jamie's existing auth users.
-- This uses a DO block to look up the user IDs by email.
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

-- 7. Sync trigger: auto-insert into approved_emails when adding to approved_accountants
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
