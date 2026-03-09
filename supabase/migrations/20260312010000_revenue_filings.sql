-- Revenue Filings — tracks all returns submitted to Revenue via ROS
-- Supports VAT3, CT1, Form 11, and future return types

CREATE TABLE IF NOT EXISTS revenue_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID NOT NULL REFERENCES auth.users(id),
  client_user_id UUID NOT NULL REFERENCES auth.users(id),
  return_type TEXT NOT NULL CHECK (return_type IN ('VAT3', 'CT1', 'Form11', 'RCT')),
  tax_year INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Filing status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitting', 'filed', 'pending', 'rejected', 'failed')),
  filing_reference TEXT,          -- Revenue's acknowledgement/reference number
  revenue_status TEXT,            -- Revenue's status string (accepted, processed, rejected, etc.)
  error_message TEXT,

  -- XML data
  return_xml TEXT,                -- The return XML sent to Revenue
  response_xml TEXT,              -- Revenue's SOAP response

  -- Summary for quick display (stored as JSONB to avoid re-parsing XML)
  summary_data JSONB,

  -- Metadata
  test_mode BOOLEAN NOT NULL DEFAULT true,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_revenue_filings_client ON revenue_filings(client_user_id, tax_year);
CREATE INDEX idx_revenue_filings_accountant ON revenue_filings(accountant_id);
CREATE INDEX idx_revenue_filings_type_period ON revenue_filings(return_type, period_start, period_end);

-- RLS
ALTER TABLE revenue_filings ENABLE ROW LEVEL SECURITY;

-- Accountants can manage filings they created
CREATE POLICY "accountant_manage_filings" ON revenue_filings
  FOR ALL USING (accountant_id = auth.uid());

-- Clients can view their own filings (read-only)
CREATE POLICY "client_view_filings" ON revenue_filings
  FOR SELECT USING (client_user_id = auth.uid());
