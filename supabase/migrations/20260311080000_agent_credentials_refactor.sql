-- ==========================================================================
-- Migration: Agent Credentials Refactor
-- Move Revenue credentials from per-client to per-accountant (TAIN-based)
-- ==========================================================================

-- 1. Create accountant_revenue_credentials table
CREATE TABLE IF NOT EXISTS accountant_revenue_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  tain TEXT NOT NULL,                          -- Tax Agent Identification Number
  agent_name TEXT NOT NULL,                    -- Practice name on ROS
  ros_cert_serial TEXT,                        -- Digital cert serial
  tax_registration_number TEXT NOT NULL,       -- Agent's own tax ref
  is_active BOOLEAN DEFAULT TRUE,
  test_mode BOOLEAN DEFAULT TRUE,             -- PIT vs production
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add client-level Revenue linkage fields to accountant_clients
ALTER TABLE accountant_clients ADD COLUMN IF NOT EXISTS employer_reg_number TEXT;
ALTER TABLE accountant_clients ADD COLUMN IF NOT EXISTS tax_reg_number TEXT;
ALTER TABLE accountant_clients ADD COLUMN IF NOT EXISTS rct_principal_number TEXT;
ALTER TABLE accountant_clients ADD COLUMN IF NOT EXISTS revenue_linked BOOLEAN DEFAULT FALSE;
ALTER TABLE accountant_clients ADD COLUMN IF NOT EXISTS revenue_link_verified_at TIMESTAMPTZ;

-- 3. Enable RLS on accountant_revenue_credentials
ALTER TABLE accountant_revenue_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants manage own credentials" ON accountant_revenue_credentials
  FOR ALL USING (auth.uid() = accountant_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_accountant_revenue_credentials_accountant_id
  ON accountant_revenue_credentials(accountant_id);

CREATE INDEX IF NOT EXISTS idx_accountant_clients_revenue_linked
  ON accountant_clients(revenue_linked)
  WHERE revenue_linked = TRUE;

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_accountant_revenue_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accountant_revenue_credentials_updated_at
  BEFORE UPDATE ON accountant_revenue_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_accountant_revenue_credentials_updated_at();

-- 6. Drop old revenue_credentials table (was created in eRCT migration)
DROP TABLE IF EXISTS revenue_credentials;
