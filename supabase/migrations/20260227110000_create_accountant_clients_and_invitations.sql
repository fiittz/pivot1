-- Phase 2: Client Management + Invitations
-- Creates accountant_clients and client_invitations tables

-- ============================================================
-- 1. ENUMs
-- ============================================================
CREATE TYPE client_status AS ENUM ('pending_invite', 'active', 'suspended', 'archived');
CREATE TYPE client_access_level AS ENUM ('read_only', 'read_write', 'full');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- ============================================================
-- 2. TABLE: accountant_clients — core link between accountant and client
-- ============================================================
CREATE TABLE public.accountant_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID NOT NULL REFERENCES public.accountant_practices(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_business_name TEXT,
  client_phone TEXT,
  status client_status NOT NULL DEFAULT 'pending_invite',
  access_level client_access_level NOT NULL DEFAULT 'read_only',
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  engagement_type TEXT,
  fee_amount NUMERIC(10,2),
  fee_frequency TEXT,
  year_end_month INTEGER CHECK (year_end_month >= 1 AND year_end_month <= 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accountant_clients ENABLE ROW LEVEL SECURITY;

-- Accountant can manage their own clients
CREATE POLICY "Accountants can view their own clients"
  ON public.accountant_clients FOR SELECT
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can insert their own clients"
  ON public.accountant_clients FOR INSERT
  WITH CHECK (auth.uid() = accountant_id);

CREATE POLICY "Accountants can update their own clients"
  ON public.accountant_clients FOR UPDATE
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can delete their own clients"
  ON public.accountant_clients FOR DELETE
  USING (auth.uid() = accountant_id);

-- Clients can view their own link record
CREATE POLICY "Clients can view their own link"
  ON public.accountant_clients FOR SELECT
  USING (auth.uid() = client_user_id);

-- Indexes
CREATE INDEX idx_accountant_clients_accountant_id ON public.accountant_clients(accountant_id);
CREATE INDEX idx_accountant_clients_practice_id ON public.accountant_clients(practice_id);
CREATE INDEX idx_accountant_clients_client_user_id ON public.accountant_clients(client_user_id);
CREATE INDEX idx_accountant_clients_status ON public.accountant_clients(status);

-- Trigger for updated_at
CREATE TRIGGER update_accountant_clients_updated_at
  BEFORE UPDATE ON public.accountant_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. TABLE: client_invitations — invitation tracking
-- ============================================================
CREATE TABLE public.client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES public.accountant_practices(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email TEXT NOT NULL,
  invite_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invite_status NOT NULL DEFAULT 'pending',
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(invite_token)
);

ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Accountant can manage their own invitations
CREATE POLICY "Accountants can view their own invitations"
  ON public.client_invitations FOR SELECT
  USING (auth.uid() = accountant_id);

CREATE POLICY "Accountants can insert their own invitations"
  ON public.client_invitations FOR INSERT
  WITH CHECK (auth.uid() = accountant_id);

CREATE POLICY "Accountants can update their own invitations"
  ON public.client_invitations FOR UPDATE
  USING (auth.uid() = accountant_id);

-- Indexes
CREATE INDEX idx_client_invitations_accountant_id ON public.client_invitations(accountant_id);
CREATE INDEX idx_client_invitations_invite_token ON public.client_invitations(invite_token);
CREATE INDEX idx_client_invitations_invite_email ON public.client_invitations(invite_email);
