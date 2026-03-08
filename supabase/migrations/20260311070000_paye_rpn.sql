-- Revenue PAYE RPN (Revenue Payroll Notification) and Payroll Submissions
-- Phase 2 payroll: integrates with Revenue's PAYE Employer REST API

-- Cached RPN data from Revenue for each employee per tax year
CREATE TABLE employee_rpns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  ppsn TEXT NOT NULL,
  tax_credits NUMERIC(10,2),            -- annual tax credits from Revenue
  standard_rate_cutoff NUMERIC(10,2),   -- annual standard rate cut-off
  usc_status TEXT DEFAULT 'normal',     -- normal, exempt, reduced
  prsi_class TEXT DEFAULT 'A1',
  previous_pay NUMERIC(12,2) DEFAULT 0, -- pay from previous employment
  previous_tax NUMERIC(12,2) DEFAULT 0,
  previous_usc NUMERIC(12,2) DEFAULT 0,
  previous_prsi NUMERIC(12,2) DEFAULT 0,
  effective_date DATE,
  rpn_number TEXT,                       -- Revenue RPN reference
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revenue_response JSONB,
  UNIQUE(employee_id, tax_year)
);

-- Payroll submissions sent to Revenue via PAYE Employer API
CREATE TABLE payroll_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id),
  tax_year INT NOT NULL,
  pay_period INT NOT NULL,
  submission_id TEXT,                    -- Revenue-assigned ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'error')),
  request_payload JSONB,
  response_payload JSONB,
  error_details TEXT,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_employee_rpns_user ON employee_rpns(user_id);
CREATE INDEX idx_employee_rpns_employee ON employee_rpns(employee_id, tax_year);
CREATE INDEX idx_employee_rpns_ppsn ON employee_rpns(ppsn);

CREATE INDEX idx_payroll_submissions_user ON payroll_submissions(user_id);
CREATE INDEX idx_payroll_submissions_run ON payroll_submissions(payroll_run_id);
CREATE INDEX idx_payroll_submissions_status ON payroll_submissions(status);
CREATE INDEX idx_payroll_submissions_year_period ON payroll_submissions(tax_year, pay_period);

-- RLS
ALTER TABLE employee_rpns ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_submissions ENABLE ROW LEVEL SECURITY;

-- Users see their own RPNs
CREATE POLICY "Users see own employee_rpns"
  ON employee_rpns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own employee_rpns"
  ON employee_rpns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own employee_rpns"
  ON employee_rpns FOR UPDATE
  USING (auth.uid() = user_id);

-- Users see their own payroll submissions
CREATE POLICY "Users see own payroll_submissions"
  ON payroll_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own payroll_submissions"
  ON payroll_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own payroll_submissions"
  ON payroll_submissions FOR UPDATE
  USING (auth.uid() = user_id);

-- Accountants see client RPNs
CREATE POLICY "Accountants see client employee_rpns"
  ON employee_rpns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_rpns.user_id
    )
  );

CREATE POLICY "Accountants insert client employee_rpns"
  ON employee_rpns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_rpns.user_id
    )
  );

CREATE POLICY "Accountants update client employee_rpns"
  ON employee_rpns FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_rpns.user_id
    )
  );

-- Accountants see client payroll submissions
CREATE POLICY "Accountants see client payroll_submissions"
  ON payroll_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = payroll_submissions.user_id
    )
  );

CREATE POLICY "Accountants insert client payroll_submissions"
  ON payroll_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = payroll_submissions.user_id
    )
  );

CREATE POLICY "Accountants update client payroll_submissions"
  ON payroll_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = payroll_submissions.user_id
    )
  );
