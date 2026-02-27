-- Phase 6: Filing Records — Review + XML Export
-- Tracks filings per client with questionnaire snapshots and approval workflow.

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.filing_type AS ENUM (
  'ct1', 'form11', 'vat3', 'rct_monthly', 'b1', 'annual_return'
);

CREATE TYPE public.filing_status AS ENUM (
  'draft', 'in_review', 'approved', 'filed', 'acknowledged'
);

-- ============================================================
-- 2. filing_records table
-- ============================================================
CREATE TABLE public.filing_records (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id     UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  accountant_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  filing_type              public.filing_type NOT NULL,
  tax_period_start         DATE NOT NULL,
  tax_period_end           DATE NOT NULL,

  status                   public.filing_status NOT NULL DEFAULT 'draft',

  -- Immutable snapshot of client data at the time of filing creation
  questionnaire_snapshot   JSONB,

  -- Accountant review
  accountant_reviewed      BOOLEAN NOT NULL DEFAULT FALSE,
  accountant_approved      BOOLEAN NOT NULL DEFAULT FALSE,
  accountant_review_notes  TEXT,
  approved_at              TIMESTAMPTZ,

  -- XML generation
  xml_generated_at         TIMESTAMPTZ,
  xml_file_url             TEXT,

  -- ROS filing
  filed_at                 TIMESTAMPTZ,
  ros_acknowledgement      TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.filing_records ENABLE ROW LEVEL SECURITY;

-- Accountant manages own filings
CREATE POLICY "Accountants manage own filing records"
  ON public.filing_records FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

-- Client can view own filings
CREATE POLICY "Clients can view own filing records"
  ON public.filing_records FOR SELECT
  USING (client_user_id = auth.uid());

-- ============================================================
-- 3. Indexes
-- ============================================================

-- Per-client filings
CREATE INDEX idx_filing_records_client
  ON public.filing_records(accountant_client_id, filing_type, tax_period_start DESC);

-- Cross-client: pending filings for an accountant
CREATE INDEX idx_filing_records_accountant_status
  ON public.filing_records(accountant_id, status, created_at DESC);

-- ============================================================
-- 4. Auto-update updated_at
-- ============================================================
CREATE TRIGGER update_filing_records_updated_at
  BEFORE UPDATE ON public.filing_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
