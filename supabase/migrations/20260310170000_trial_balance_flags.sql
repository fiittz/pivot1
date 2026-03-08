-- Trial balance line item flags: accountant can flag any nominal account
-- and request info from the client about specific balances.

CREATE TABLE IF NOT EXISTS trial_balance_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES auth.users(id),
  client_user_id UUID NOT NULL REFERENCES auth.users(id),
  tax_year INTEGER NOT NULL,

  -- What's flagged
  account_name TEXT NOT NULL,            -- nominal account name
  account_type TEXT NOT NULL,            -- Income, Expense, Asset, etc.
  flagged_amount NUMERIC NOT NULL,       -- the amount that triggered concern
  flag_type TEXT NOT NULL DEFAULT 'query', -- 'query' | 'warning' | 'adjustment_needed'

  -- Accountant's note / question
  note TEXT NOT NULL,                    -- e.g. "This seems high — can you explain?"

  -- Resolution
  status TEXT NOT NULL DEFAULT 'open',   -- 'open' | 'responded' | 'resolved'
  client_response TEXT,                  -- client's answer
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,

  -- Link to document request if one was created
  document_request_id UUID REFERENCES document_requests(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tb_flags_client
  ON trial_balance_flags (accountant_client_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_tb_flags_status
  ON trial_balance_flags (status) WHERE status = 'open';

ALTER TABLE trial_balance_flags ENABLE ROW LEVEL SECURITY;

-- Accountants can manage flags for their clients
CREATE POLICY "Accountants manage TB flags"
  ON trial_balance_flags FOR ALL TO authenticated
  USING (auth.uid() = accountant_id)
  WITH CHECK (auth.uid() = accountant_id);

-- Clients can read and respond to flags about their data
CREATE POLICY "Clients can read and respond to TB flags"
  ON trial_balance_flags FOR ALL TO authenticated
  USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);
