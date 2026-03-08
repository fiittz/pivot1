-- Journal entries: manual adjustments posted by accountants
-- (bad debt write-offs, year-end accruals, depreciation, intercompany, etc.)

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),          -- client whose books are affected
  accountant_id UUID NOT NULL REFERENCES auth.users(id),    -- accountant who posted
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL,                                    -- e.g. "JE-001"
  entry_type TEXT NOT NULL DEFAULT 'adjustment',             -- 'adjustment' | 'accrual' | 'depreciation' | 'bad_debt' | 'correction' | 'opening_balance' | 'closing'
  tax_year INTEGER NOT NULL,
  is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_by UUID REFERENCES journal_entries(id),           -- points to the reversing entry
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,                                -- Income / Expense / Asset / Liability / Equity
  account_code TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_year
  ON journal_entries (user_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_journal_entries_accountant
  ON journal_entries (accountant_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
  ON journal_entry_lines (journal_entry_id);

-- RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Accountants can manage journal entries for their clients
CREATE POLICY "Accountants manage journal entries"
  ON journal_entries FOR ALL TO authenticated
  USING (
    auth.uid() = accountant_id
    OR EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.accountant_id = auth.uid()
        AND ac.client_user_id = journal_entries.user_id
        AND ac.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = accountant_id
  );

-- Clients can read their own journal entries
CREATE POLICY "Clients read own journal entries"
  ON journal_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Journal entry lines: accountants can manage, clients can read
CREATE POLICY "Accountants manage journal entry lines"
  ON journal_entry_lines FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND (
          je.accountant_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM accountant_clients ac
            WHERE ac.accountant_id = auth.uid()
              AND ac.client_user_id = je.user_id
              AND ac.status = 'active'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND je.accountant_id = auth.uid()
    )
  );

CREATE POLICY "Clients read own journal entry lines"
  ON journal_entry_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND je.user_id = auth.uid()
    )
  );
