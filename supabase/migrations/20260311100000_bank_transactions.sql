-- Bank transactions: raw bank feed data before matching/categorisation
-- Used by the transaction matcher to reconcile against invoices and payroll

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference TEXT,
  amount NUMERIC(12,2) NOT NULL,
  balance NUMERIC(12,2),
  is_matched BOOLEAN NOT NULL DEFAULT FALSE,
  matched_transaction_id UUID REFERENCES transactions(id),
  import_batch_id UUID REFERENCES import_batches(id),
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bank_transactions_user ON bank_transactions(user_id);
CREATE INDEX idx_bank_transactions_account ON bank_transactions(account_id);
CREATE INDEX idx_bank_transactions_unmatched ON bank_transactions(user_id, is_matched) WHERE is_matched = FALSE;
CREATE INDEX idx_bank_transactions_date ON bank_transactions(user_id, transaction_date);

-- RLS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank_transactions" ON bank_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Accountants see client bank_transactions" ON bank_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = bank_transactions.user_id)
);

CREATE POLICY "Accountants manage client bank_transactions" ON bank_transactions FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = bank_transactions.user_id)
);

-- Trigger
CREATE TRIGGER update_bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
