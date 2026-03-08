-- Working papers for aged debtors and creditors
CREATE TABLE debtor_creditor_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  paper_type TEXT NOT NULL CHECK (paper_type IN ('debtors', 'creditors')),
  as_at_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent_for_confirmation', 'confirmed', 'finalised')),
  notes TEXT,
  reconciliation_request_id UUID REFERENCES reconciliation_requests(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tax_year, paper_type)
);

CREATE TABLE debtor_creditor_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES debtor_creditor_papers(id) ON DELETE CASCADE,
  counterparty_name TEXT NOT NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('trade', 'accrued_income', 'prepayment_received', 'accrual', 'prepayment_made')),
  reference TEXT,
  original_date DATE,
  due_date DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'invoice', 'receipt', 'imported')),
  source_id UUID,
  confirmed_amount NUMERIC(12,2),
  confirmation_status TEXT CHECK (confirmation_status IN ('confirmed', 'disputed', 'paid', 'partial', 'unknown')),
  confirmation_note TEXT,
  confirmed_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dc_papers_user ON debtor_creditor_papers(user_id, tax_year);
CREATE INDEX idx_dc_papers_ac ON debtor_creditor_papers(accountant_client_id);
CREATE INDEX idx_dc_lines_paper ON debtor_creditor_lines(paper_id);

ALTER TABLE debtor_creditor_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtor_creditor_lines ENABLE ROW LEVEL SECURITY;

-- Accountants manage papers for their clients
CREATE POLICY "Accountants manage papers" ON debtor_creditor_papers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.id = debtor_creditor_papers.accountant_client_id AND ac.accountant_id = auth.uid())
  );

-- Clients see their own papers
CREATE POLICY "Clients see own papers" ON debtor_creditor_papers
  FOR SELECT USING (auth.uid() = user_id);

-- Clients can update confirmation-related fields
CREATE POLICY "Clients update papers" ON debtor_creditor_papers
  FOR UPDATE USING (auth.uid() = user_id);

-- Lines: accountants full access via parent
CREATE POLICY "Accountants manage lines" ON debtor_creditor_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM debtor_creditor_papers p JOIN accountant_clients ac ON ac.id = p.accountant_client_id WHERE p.id = debtor_creditor_lines.paper_id AND ac.accountant_id = auth.uid())
  );

-- Lines: clients can read
CREATE POLICY "Clients read lines" ON debtor_creditor_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM debtor_creditor_papers p WHERE p.id = debtor_creditor_lines.paper_id AND p.user_id = auth.uid())
  );

-- Lines: clients can update confirmation fields
CREATE POLICY "Clients update lines" ON debtor_creditor_lines
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM debtor_creditor_papers p WHERE p.id = debtor_creditor_lines.paper_id AND p.user_id = auth.uid())
  );
