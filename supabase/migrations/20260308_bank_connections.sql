-- Open Banking connections (Enable Banking)
CREATE TABLE IF NOT EXISTS bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'IE',
  state TEXT,                          -- CSRF state for auth flow
  session_id TEXT,                     -- Enable Banking session ID
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, expired, failed, disconnected
  accounts JSONB DEFAULT '[]',         -- Array of account UIDs
  account_details JSONB DEFAULT '[]',  -- Account details (IBAN, name, currency)
  error_detail TEXT,
  connected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_connections_user ON bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON bank_connections(status);

-- Add open banking fields to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_connection_id UUID REFERENCES bank_connections(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS mcc_code INTEGER;

CREATE INDEX idx_transactions_bank_txn_id ON transactions(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;

-- RLS policies
ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank connections"
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank connections"
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank connections"
  ON bank_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank connections"
  ON bank_connections FOR DELETE
  USING (auth.uid() = user_id);
