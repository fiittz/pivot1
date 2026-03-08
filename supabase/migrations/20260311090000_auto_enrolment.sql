-- Auto-Enrolment (MyFutureFund / NAERSA) tables
-- Tracks employee enrolment status, contributions, and NAERSA submissions

-- 1. Employee auto-enrolment status
CREATE TABLE employee_auto_enrolment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'enrolled', 'opted_out', 'suspended', 'exempt', 'ineligible')),
  enrolled_at TIMESTAMPTZ,
  opt_out_window_start DATE,           -- 6 months after enrolment
  opt_out_window_end DATE,             -- 2 months after window start
  opted_out_at TIMESTAMPTZ,
  next_re_enrolment_date DATE,         -- 2 years after opt-out
  suspension_start DATE,
  has_qualifying_pension BOOLEAN DEFAULT FALSE,
  qualifying_pension_details TEXT,
  aepn_reference TEXT,                 -- from NAERSA
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id)
);

-- 2. Contribution records per pay period
CREATE TABLE auto_enrolment_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  payroll_run_id UUID REFERENCES payroll_runs(id),
  pay_period INT NOT NULL,
  tax_year INT NOT NULL,
  pensionable_earnings NUMERIC(12,2) NOT NULL,
  employee_contribution NUMERIC(10,2) NOT NULL,
  employer_contribution NUMERIC(10,2) NOT NULL,
  state_top_up NUMERIC(10,2) NOT NULL,
  total_contribution NUMERIC(10,2) NOT NULL,
  employee_rate NUMERIC(5,3) NOT NULL,
  employer_rate NUMERIC(5,3) NOT NULL,
  state_rate NUMERIC(5,3) NOT NULL,
  submitted_to_naersa BOOLEAN DEFAULT FALSE,
  naersa_submission_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Batch submissions to NAERSA
CREATE TABLE naersa_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  payroll_run_id UUID REFERENCES payroll_runs(id),
  employer_reg_number TEXT NOT NULL,
  tax_year INT NOT NULL,
  pay_period INT NOT NULL,
  total_employee_contributions NUMERIC(12,2) NOT NULL,
  total_employer_contributions NUMERIC(12,2) NOT NULL,
  employee_count INT NOT NULL,
  submission_ref TEXT,                  -- NAERSA reference
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'accepted', 'rejected', 'error')),
  request_payload JSONB,
  response_payload JSONB,
  error_details TEXT,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX idx_employee_auto_enrolment_user ON employee_auto_enrolment(user_id);
CREATE INDEX idx_employee_auto_enrolment_employee ON employee_auto_enrolment(employee_id);
CREATE INDEX idx_employee_auto_enrolment_status ON employee_auto_enrolment(status);

CREATE INDEX idx_ae_contributions_user ON auto_enrolment_contributions(user_id);
CREATE INDEX idx_ae_contributions_employee ON auto_enrolment_contributions(employee_id);
CREATE INDEX idx_ae_contributions_run ON auto_enrolment_contributions(payroll_run_id);
CREATE INDEX idx_ae_contributions_year_period ON auto_enrolment_contributions(tax_year, pay_period);
CREATE INDEX idx_ae_contributions_submitted ON auto_enrolment_contributions(submitted_to_naersa);

CREATE INDEX idx_naersa_submissions_user ON naersa_submissions(user_id);
CREATE INDEX idx_naersa_submissions_run ON naersa_submissions(payroll_run_id);
CREATE INDEX idx_naersa_submissions_status ON naersa_submissions(status);
CREATE INDEX idx_naersa_submissions_year_period ON naersa_submissions(tax_year, pay_period);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE employee_auto_enrolment ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_enrolment_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE naersa_submissions ENABLE ROW LEVEL SECURITY;

-- Users see their own employee_auto_enrolment
CREATE POLICY "Users see own employee_auto_enrolment"
  ON employee_auto_enrolment FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own employee_auto_enrolment"
  ON employee_auto_enrolment FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own employee_auto_enrolment"
  ON employee_auto_enrolment FOR UPDATE
  USING (auth.uid() = user_id);

-- Users see their own auto_enrolment_contributions
CREATE POLICY "Users see own auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users see their own naersa_submissions
CREATE POLICY "Users see own naersa_submissions"
  ON naersa_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own naersa_submissions"
  ON naersa_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own naersa_submissions"
  ON naersa_submissions FOR UPDATE
  USING (auth.uid() = user_id);

-- Accountants see client employee_auto_enrolment
CREATE POLICY "Accountants see client employee_auto_enrolment"
  ON employee_auto_enrolment FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_auto_enrolment.user_id
    )
  );

CREATE POLICY "Accountants insert client employee_auto_enrolment"
  ON employee_auto_enrolment FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_auto_enrolment.user_id
    )
  );

CREATE POLICY "Accountants update client employee_auto_enrolment"
  ON employee_auto_enrolment FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = employee_auto_enrolment.user_id
    )
  );

-- Accountants see client auto_enrolment_contributions
CREATE POLICY "Accountants see client auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = auto_enrolment_contributions.user_id
    )
  );

CREATE POLICY "Accountants insert client auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = auto_enrolment_contributions.user_id
    )
  );

CREATE POLICY "Accountants update client auto_enrolment_contributions"
  ON auto_enrolment_contributions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = auto_enrolment_contributions.user_id
    )
  );

-- Accountants see client naersa_submissions
CREATE POLICY "Accountants see client naersa_submissions"
  ON naersa_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = naersa_submissions.user_id
    )
  );

CREATE POLICY "Accountants insert client naersa_submissions"
  ON naersa_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = naersa_submissions.user_id
    )
  );

CREATE POLICY "Accountants update client naersa_submissions"
  ON naersa_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = naersa_submissions.user_id
    )
  );

-- ─── updated_at trigger for employee_auto_enrolment ─────────────────────────

CREATE OR REPLACE FUNCTION update_employee_auto_enrolment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employee_auto_enrolment_updated_at
  BEFORE UPDATE ON employee_auto_enrolment
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_auto_enrolment_updated_at();
