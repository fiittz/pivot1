-- Phase 1: Role System + Accountant Practices
-- Creates user_roles table (decoupled from profiles) and accountant_practices table

-- ============================================================
-- 1. ENUM: user_role_type
-- ============================================================
CREATE TYPE user_role_type AS ENUM ('owner', 'accountant');

-- ============================================================
-- 2. TABLE: user_roles
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast role lookups
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- ============================================================
-- 3. TABLE: accountant_practices
-- ============================================================
CREATE TABLE public.accountant_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_agent_number TEXT, -- TAIN
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accountant_practices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants can view their own practice"
  ON public.accountant_practices FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Accountants can insert their own practice"
  ON public.accountant_practices FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Accountants can update their own practice"
  ON public.accountant_practices FOR UPDATE
  USING (auth.uid() = owner_id);

-- Trigger for updated_at
CREATE TRIGGER update_accountant_practices_updated_at
  BEFORE UPDATE ON public.accountant_practices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for owner lookup
CREATE INDEX idx_accountant_practices_owner_id ON public.accountant_practices(owner_id);

-- ============================================================
-- 4. TRIGGER: auto-assign 'owner' role on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_owner_role();

-- ============================================================
-- 5. BACKFILL: seed all existing users as 'owner'
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::user_role_type
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;
