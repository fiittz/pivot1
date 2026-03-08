-- Add co-pilot toggle to accountant_clients
ALTER TABLE accountant_clients
  ADD COLUMN IF NOT EXISTS copilot_enabled BOOLEAN NOT NULL DEFAULT false;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_accountant_clients_copilot
  ON accountant_clients (accountant_id) WHERE copilot_enabled = true;
