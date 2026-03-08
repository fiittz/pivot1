-- Filing deadlines — what's due and when
CREATE TABLE IF NOT EXISTS filing_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,              -- 'ct1' | 'form11' | 'vat_return'
  tax_year INTEGER NOT NULL,             -- 2025, 2026, etc.
  period TEXT,                           -- null for annual, 'Q1'/'Q2' etc for VAT
  due_date DATE NOT NULL,
  reminder_sent_at TIMESTAMPTZ,          -- when first reminder was sent
  second_reminder_at TIMESTAMPTZ,
  urgent_reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_filing_deadlines_unique
  ON filing_deadlines(user_id, report_type, tax_year, coalesce(period, ''));
CREATE INDEX idx_filing_deadlines_due ON filing_deadlines(due_date);

-- Finalization requests — questionnaire sent to client
CREATE TABLE IF NOT EXISTS finalization_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,              -- 'ct1' | 'form11'
  tax_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'sent' | 'in_progress' | 'completed'
  questionnaire_data JSONB DEFAULT '{}', -- client's answers
  receipt_coverage JSONB DEFAULT '{}',   -- { total: 117, matched: 89, unmatched: 28, uncategorised: 3 }
  missing_receipts JSONB DEFAULT '[]',   -- array of { transaction_id, description, amount, date, category }
  sent_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_finalization_requests_user ON finalization_requests(user_id);
CREATE INDEX idx_finalization_requests_status ON finalization_requests(status);
CREATE UNIQUE INDEX idx_finalization_requests_unique
  ON finalization_requests(user_id, report_type, tax_year);

-- Client reports — approved by accountant, visible to client
CREATE TABLE IF NOT EXISTS client_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID REFERENCES auth.users(id),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,              -- 'ct1' | 'form11' | 'vat_return' | 'balance_sheet'
  tax_year INTEGER NOT NULL,
  period TEXT,                           -- null for annual, period for VAT
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'approved' | 'sent' | 'acknowledged'
  report_data JSONB DEFAULT '{}',        -- frozen numbers at time of approval
  notes TEXT,                            -- accountant notes to client
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_reports_client ON client_reports(client_user_id);
CREATE INDEX idx_client_reports_status ON client_reports(status);

-- RLS policies
ALTER TABLE filing_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE finalization_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_reports ENABLE ROW LEVEL SECURITY;

-- Filing deadlines: users see their own
CREATE POLICY "Users can view own filing deadlines"
  ON filing_deadlines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages filing deadlines"
  ON filing_deadlines FOR ALL USING (true) WITH CHECK (true);

-- Finalization requests: users see their own
CREATE POLICY "Users can view own finalization requests"
  ON finalization_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own finalization requests"
  ON finalization_requests FOR UPDATE USING (auth.uid() = user_id);

-- Client reports: client sees their own sent/acknowledged reports
CREATE POLICY "Clients can view sent reports"
  ON client_reports FOR SELECT
  USING (auth.uid() = client_user_id AND status IN ('sent', 'acknowledged'));
CREATE POLICY "Clients can acknowledge reports"
  ON client_reports FOR UPDATE
  USING (auth.uid() = client_user_id AND status = 'sent');
