-- Migration: CRO Integration tables
-- Creates cro_companies, cro_filings, cro_annual_accounts tables
-- Adds CRO fields to accountant_clients
-- Sets up RLS policies for all new tables

-- =============================================================================
-- 1. cro_companies table
-- =============================================================================

CREATE TABLE public.cro_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_num TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  company_status_desc TEXT,
  company_status_code INTEGER,
  comp_type_desc TEXT,
  company_type_code INTEGER,
  company_reg_date DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  address_line3 TEXT,
  address_line4 TEXT,
  eircode TEXT,
  last_ar_date DATE,
  next_ar_date DATE,
  last_acc_date DATE,
  last_synced_at TIMESTAMPTZ,
  sync_error TEXT,
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cro_companies_user ON cro_companies(user_id);
CREATE INDEX idx_cro_companies_num ON cro_companies(company_num);
CREATE INDEX idx_cro_companies_next_ar ON cro_companies(next_ar_date);

-- =============================================================================
-- 2. cro_filings table
-- =============================================================================

CREATE TABLE public.cro_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cro_company_id UUID NOT NULL REFERENCES public.cro_companies(id) ON DELETE CASCADE,
  doc_id TEXT,
  sub_num TEXT,
  sub_type_desc TEXT NOT NULL,
  doc_type_desc TEXT,
  sub_status_desc TEXT,
  sub_received_date DATE,
  sub_effective_date DATE,
  acc_year_to_date DATE,
  num_pages INTEGER,
  file_size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cro_filings_company ON cro_filings(cro_company_id, sub_received_date DESC);
CREATE INDEX idx_cro_filings_year ON cro_filings(cro_company_id, acc_year_to_date);

-- =============================================================================
-- 3. cro_annual_accounts table
-- =============================================================================

CREATE TABLE public.cro_annual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cro_company_id UUID NOT NULL REFERENCES public.cro_companies(id) ON DELETE CASCADE,
  cro_filing_id UUID REFERENCES public.cro_filings(id) ON DELETE SET NULL,
  financial_year_end DATE NOT NULL,
  period_start DATE,
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (data_source IN ('manual', 'balnce_auto', 'pdf_extraction', 'accountant_import')),
  -- Balance Sheet: Fixed Assets
  fixed_assets_tangible NUMERIC(14,2),
  fixed_assets_intangible NUMERIC(14,2),
  fixed_assets_investments NUMERIC(14,2),
  -- Balance Sheet: Current Assets
  current_assets_stock NUMERIC(14,2),
  current_assets_debtors NUMERIC(14,2),
  current_assets_cash NUMERIC(14,2),
  current_assets_other NUMERIC(14,2),
  -- Balance Sheet: Liabilities
  creditors_within_one_year NUMERIC(14,2),
  net_current_assets NUMERIC(14,2),
  creditors_after_one_year NUMERIC(14,2),
  provisions_for_liabilities NUMERIC(14,2),
  net_assets NUMERIC(14,2),
  -- Balance Sheet: Capital & Reserves
  share_capital NUMERIC(14,2),
  share_premium NUMERIC(14,2),
  retained_profits NUMERIC(14,2),
  other_reserves NUMERIC(14,2),
  shareholders_funds NUMERIC(14,2),
  -- P&L Summary
  turnover NUMERIC(14,2),
  cost_of_sales NUMERIC(14,2),
  gross_profit NUMERIC(14,2),
  operating_expenses NUMERIC(14,2),
  operating_profit NUMERIC(14,2),
  interest_payable NUMERIC(14,2),
  profit_before_tax NUMERIC(14,2),
  taxation NUMERIC(14,2),
  profit_after_tax NUMERIC(14,2),
  dividends_paid NUMERIC(14,2),
  retained_profit_for_year NUMERIC(14,2),
  -- Notes to the Accounts (structured JSONB)
  notes JSONB NOT NULL DEFAULT '{}',
  -- PDF attachment
  pdf_storage_path TEXT,
  extraction_status TEXT CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extraction_confidence NUMERIC(3,2),
  -- Accountant review
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cro_company_id, financial_year_end)
);

CREATE INDEX idx_cro_annual_accounts_company ON cro_annual_accounts(cro_company_id, financial_year_end DESC);

-- =============================================================================
-- 4. Alter accountant_clients to add CRO fields
-- =============================================================================

ALTER TABLE public.accountant_clients
  ADD COLUMN IF NOT EXISTS cro_number TEXT,
  ADD COLUMN IF NOT EXISTS cro_company_id UUID REFERENCES public.cro_companies(id) ON DELETE SET NULL;

CREATE INDEX idx_accountant_clients_cro ON public.accountant_clients(cro_number) WHERE cro_number IS NOT NULL;

-- =============================================================================
-- 5. Helper function for accountant access to CRO companies
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_accountant_for_cro_company(target_cro_company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.accountant_clients ac
    JOIN public.cro_companies cc ON cc.id = ac.cro_company_id
    WHERE ac.accountant_id = auth.uid()
      AND cc.id = target_cro_company_id
      AND ac.status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.cro_companies cc
    JOIN public.accountant_clients ac ON ac.client_user_id = cc.user_id
    WHERE cc.id = target_cro_company_id
      AND ac.accountant_id = auth.uid()
      AND ac.status = 'active'
  );
END;
$$;

-- =============================================================================
-- 6. Enable RLS on all new tables
-- =============================================================================

ALTER TABLE public.cro_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cro_annual_accounts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 7. RLS policies for cro_companies
-- =============================================================================

CREATE POLICY "cro_companies_select"
  ON public.cro_companies FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_accountant_for_cro_company(id)
  );

CREATE POLICY "cro_companies_insert"
  ON public.cro_companies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cro_companies_update"
  ON public.cro_companies FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_accountant_for_cro_company(id)
  );

-- =============================================================================
-- 8. RLS policies for cro_filings
-- =============================================================================

CREATE POLICY "cro_filings_select"
  ON public.cro_filings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );

CREATE POLICY "cro_filings_insert"
  ON public.cro_filings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );

CREATE POLICY "cro_filings_update"
  ON public.cro_filings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );

-- =============================================================================
-- 9. RLS policies for cro_annual_accounts
-- =============================================================================

CREATE POLICY "cro_annual_accounts_select"
  ON public.cro_annual_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );

CREATE POLICY "cro_annual_accounts_insert"
  ON public.cro_annual_accounts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );

CREATE POLICY "cro_annual_accounts_update"
  ON public.cro_annual_accounts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cro_companies cc
      WHERE cc.id = cro_company_id AND cc.user_id = auth.uid()
    )
    OR public.is_accountant_for_cro_company(cro_company_id)
  );
