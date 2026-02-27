-- Phase 5: Document Requests (Dext-like)
-- Accountant requests missing documents; client sees requests and uploads.

-- ============================================================
-- 1. ENUM
-- ============================================================
CREATE TYPE public.document_request_status AS ENUM (
  'pending', 'uploaded', 'accepted', 'rejected'
);

-- ============================================================
-- 2. document_requests table
-- ============================================================
CREATE TABLE public.document_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  accountant_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  status               public.document_request_status NOT NULL DEFAULT 'pending',
  due_date             DATE,
  uploaded_file_url    TEXT,
  rejection_reason     TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_requests ENABLE ROW LEVEL SECURITY;

-- Accountant can do everything on their own requests
CREATE POLICY "Accountants manage own document requests"
  ON public.document_requests FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

-- Client can SELECT their own requests
CREATE POLICY "Clients can view own document requests"
  ON public.document_requests FOR SELECT
  USING (client_user_id = auth.uid());

-- Client can UPDATE own requests (upload file, etc.)
CREATE POLICY "Clients can update own document requests"
  ON public.document_requests FOR UPDATE
  USING (client_user_id = auth.uid())
  WITH CHECK (client_user_id = auth.uid());

-- ============================================================
-- 3. Indexes
-- ============================================================

-- Accountant: list requests per client
CREATE INDEX idx_document_requests_accountant_client
  ON public.document_requests(accountant_client_id, status, created_at DESC);

-- Client: list own pending requests
CREATE INDEX idx_document_requests_client_pending
  ON public.document_requests(client_user_id, status)
  WHERE status = 'pending';

-- Accountant: cross-client pending requests
CREATE INDEX idx_document_requests_accountant_status
  ON public.document_requests(accountant_id, status, created_at DESC);

-- ============================================================
-- 4. Auto-update updated_at
-- ============================================================
CREATE TRIGGER update_document_requests_updated_at
  BEFORE UPDATE ON public.document_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
