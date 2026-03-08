-- Reconciliation confirmation requests
-- Accountant sends a list of items (debtors, creditors, balances) for client to confirm

CREATE TABLE reconciliation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES auth.users(id),
  client_user_id UUID NOT NULL REFERENCES auth.users(id),
  request_type TEXT NOT NULL DEFAULT 'aged_debtors' CHECK (request_type IN ('aged_debtors', 'aged_creditors', 'bank_balance', 'general')),
  title TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_responded', 'completed', 'cancelled')),
  as_at_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE reconciliation_request_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES reconciliation_requests(id) ON DELETE CASCADE,
  label TEXT NOT NULL,                     -- e.g. customer name or description
  reference TEXT,                          -- e.g. invoice number
  expected_amount NUMERIC(12,2) NOT NULL,  -- what accountant thinks is owed
  confirmed_amount NUMERIC(12,2),          -- what client says is actually owed
  client_status TEXT CHECK (client_status IN ('confirmed', 'paid', 'partial', 'disputed', 'unknown')),
  client_note TEXT,
  responded_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_recon_req_client ON reconciliation_requests(client_user_id);
CREATE INDEX idx_recon_req_ac ON reconciliation_requests(accountant_client_id);
CREATE INDEX idx_recon_lines_req ON reconciliation_request_lines(request_id);

ALTER TABLE reconciliation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_request_lines ENABLE ROW LEVEL SECURITY;

-- Accountants see their own requests
CREATE POLICY "Accountants manage recon requests" ON reconciliation_requests
  FOR ALL USING (auth.uid() = accountant_id);

-- Clients see requests sent to them
CREATE POLICY "Clients see own recon requests" ON reconciliation_requests
  FOR SELECT USING (auth.uid() = client_user_id);

-- Clients can update status
CREATE POLICY "Clients update recon requests" ON reconciliation_requests
  FOR UPDATE USING (auth.uid() = client_user_id)
  WITH CHECK (auth.uid() = client_user_id);

-- Lines: accountants full access via parent
CREATE POLICY "Accountants manage recon lines" ON reconciliation_request_lines
  FOR ALL USING (
    EXISTS (SELECT 1 FROM reconciliation_requests r WHERE r.id = reconciliation_request_lines.request_id AND r.accountant_id = auth.uid())
  );

-- Lines: clients can read and update
CREATE POLICY "Clients read recon lines" ON reconciliation_request_lines
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM reconciliation_requests r WHERE r.id = reconciliation_request_lines.request_id AND r.client_user_id = auth.uid())
  );

CREATE POLICY "Clients update recon lines" ON reconciliation_request_lines
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM reconciliation_requests r WHERE r.id = reconciliation_request_lines.request_id AND r.client_user_id = auth.uid())
  );
