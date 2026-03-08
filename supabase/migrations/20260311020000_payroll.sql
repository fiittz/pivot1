-- Employees / Directors
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  ppsn TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  employment_start_date DATE NOT NULL,
  employment_end_date DATE,
  is_director BOOLEAN NOT NULL DEFAULT false,
  pay_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('weekly','fortnightly','monthly')),
  annual_salary NUMERIC(12,2),
  -- Tax details (from RPN or manual entry)
  tax_credits_yearly NUMERIC(12,2) NOT NULL DEFAULT 4000,
  standard_rate_cut_off_yearly NUMERIC(12,2) NOT NULL DEFAULT 44000,
  usc_status TEXT NOT NULL DEFAULT 'ordinary' CHECK (usc_status IN ('ordinary','reduced','exempt')),
  prsi_class TEXT NOT NULL DEFAULT 'A1' CHECK (prsi_class IN ('A1','A2','S','J1','B','C','D','K')),
  rpn_number TEXT,
  rpn_effective_date DATE,
  -- Pension
  pension_employee_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  pension_employer_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payroll runs (one per pay period)
CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  tax_year INT NOT NULL,
  pay_period INT NOT NULL,
  pay_frequency TEXT NOT NULL DEFAULT 'monthly',
  pay_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','calculated','approved','submitted','accepted')),
  journal_entry_id UUID REFERENCES journal_entries(id),
  revenue_submission_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tax_year, pay_period, pay_frequency)
);

-- Payroll lines (one per employee per run)
CREATE TABLE payroll_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  -- Pay
  gross_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  overtime NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  benefit_in_kind NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Deductions
  paye_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  usc NUMERIC(12,2) NOT NULL DEFAULT 0,
  employee_prsi NUMERIC(12,2) NOT NULL DEFAULT 0,
  pension_employee NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Employer costs
  employer_prsi NUMERIC(12,2) NOT NULL DEFAULT 0,
  pension_employer NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Totals
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_employer_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Cumulative (for PAYE cumulative basis)
  cumulative_gross NUMERIC(12,2) NOT NULL DEFAULT 0,
  cumulative_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  cumulative_usc NUMERIC(12,2) NOT NULL DEFAULT 0,
  cumulative_prsi NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dividend declarations
CREATE TABLE dividend_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  employee_id UUID REFERENCES employees(id),
  recipient_name TEXT NOT NULL,
  recipient_ppsn TEXT,
  declaration_date DATE NOT NULL,
  payment_date DATE,
  gross_amount NUMERIC(12,2) NOT NULL,
  dwt_rate NUMERIC(5,2) NOT NULL DEFAULT 25,
  dwt_amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  dwt_due_date DATE NOT NULL,
  dwt_paid BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID REFERENCES journal_entries(id),
  board_resolution_ref TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'declared' CHECK (status IN ('declared','paid','dwt_filed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_payroll_runs_user ON payroll_runs(user_id, tax_year);
CREATE INDEX idx_payroll_lines_run ON payroll_lines(payroll_run_id);
CREATE INDEX idx_payroll_lines_employee ON payroll_lines(employee_id);
CREATE INDEX idx_dividends_user ON dividend_declarations(user_id);

-- RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividend_declarations ENABLE ROW LEVEL SECURITY;

-- Users see own
CREATE POLICY "Users see own employees" ON employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own payroll_runs" ON payroll_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own payroll_lines" ON payroll_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM payroll_runs pr WHERE pr.id = payroll_lines.payroll_run_id AND pr.user_id = auth.uid())
);
CREATE POLICY "Users see own dividends" ON dividend_declarations FOR SELECT USING (auth.uid() = user_id);

-- Accountants see client data
CREATE POLICY "Accountants see client employees" ON employees FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = employees.user_id)
);
CREATE POLICY "Accountants manage client employees" ON employees FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = employees.user_id)
);
CREATE POLICY "Accountants update client employees" ON employees FOR UPDATE USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = employees.user_id)
);

CREATE POLICY "Accountants see client payroll_runs" ON payroll_runs FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = payroll_runs.user_id)
);
CREATE POLICY "Accountants manage client payroll_runs" ON payroll_runs FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = payroll_runs.user_id)
);
CREATE POLICY "Accountants update client payroll_runs" ON payroll_runs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = payroll_runs.user_id)
);

CREATE POLICY "Accountants see client payroll_lines" ON payroll_lines FOR SELECT USING (
  EXISTS (SELECT 1 FROM payroll_runs pr JOIN accountant_clients ac ON ac.client_user_id = pr.user_id WHERE pr.id = payroll_lines.payroll_run_id AND ac.accountant_id = auth.uid())
);
CREATE POLICY "Accountants manage client payroll_lines" ON payroll_lines FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM payroll_runs pr JOIN accountant_clients ac ON ac.client_user_id = pr.user_id WHERE pr.id = payroll_lines.payroll_run_id AND ac.accountant_id = auth.uid())
);
CREATE POLICY "Accountants update client payroll_lines" ON payroll_lines FOR UPDATE USING (
  EXISTS (SELECT 1 FROM payroll_runs pr JOIN accountant_clients ac ON ac.client_user_id = pr.user_id WHERE pr.id = payroll_lines.payroll_run_id AND ac.accountant_id = auth.uid())
);

CREATE POLICY "Accountants see client dividends" ON dividend_declarations FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = dividend_declarations.user_id)
);
CREATE POLICY "Accountants manage client dividends" ON dividend_declarations FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = dividend_declarations.user_id)
);
CREATE POLICY "Accountants update client dividends" ON dividend_declarations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = dividend_declarations.user_id)
);
