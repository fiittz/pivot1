-- eRCT Integration: Revenue electronic Relevant Contracts Tax
-- Creates subcontractors table and full Revenue eRCT API integration tables.

-- ============================================================
-- 0. TABLE: subcontractors — RCT subcontractor registry
-- ============================================================
CREATE TABLE subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  ppsn_or_tax_ref TEXT,
  company_reg_number TEXT,
  verified_with_revenue BOOLEAN NOT NULL DEFAULT FALSE,
  last_rate_check TIMESTAMPTZ,
  revenue_rate NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subcontractors_user ON subcontractors(user_id);
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subcontractors" ON subcontractors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Accountants see client subcontractors" ON subcontractors FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = subcontractors.user_id)
);
CREATE POLICY "Accountants manage client subcontractors" ON subcontractors FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = subcontractors.user_id)
);

CREATE TRIGGER update_subcontractors_updated_at
  BEFORE UPDATE ON subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 0b. TABLE: rct_deductions — RCT deduction records
-- ============================================================
CREATE TABLE rct_deductions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  gross_amount NUMERIC(12,2) NOT NULL,
  rct_rate NUMERIC(5,2) NOT NULL,
  rct_amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  deduction_date DATE NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'filed', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rct_deductions_user ON rct_deductions(user_id);
ALTER TABLE rct_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rct_deductions" ON rct_deductions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Accountants see client rct_deductions" ON rct_deductions FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_deductions.user_id)
);

-- ============================================================
-- 1. TABLE: rct_contracts — Revenue contract notifications
-- ============================================================
CREATE TABLE rct_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  principal_name TEXT NOT NULL,
  principal_tax_ref TEXT NOT NULL,
  contract_ref TEXT NOT NULL,
  site_address TEXT,
  contract_start DATE,
  contract_end DATE,
  estimated_value NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  revenue_status TEXT,
  notified_at TIMESTAMPTZ,
  revenue_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TABLE: rct_payment_notifications — deduction authorisations
-- ============================================================
CREATE TABLE rct_payment_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contract_id UUID REFERENCES rct_contracts(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  invoice_id UUID REFERENCES invoices(id),
  deduction_id UUID REFERENCES rct_deductions(id),
  gross_amount NUMERIC(12,2) NOT NULL,
  rct_rate_applied NUMERIC(5,2) NOT NULL,
  rct_amount NUMERIC(12,2) NOT NULL,
  net_amount NUMERIC(12,2) NOT NULL,
  deduction_ref_number TEXT,
  payment_date DATE NOT NULL,
  revenue_request JSONB,
  revenue_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorised', 'rejected', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. TABLE: rct_rate_lookups — cached rate lookups from Revenue
-- ============================================================
CREATE TABLE rct_rate_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id),
  tax_reference TEXT NOT NULL,
  rate_returned NUMERIC(5,2) NOT NULL,
  valid_from DATE,
  valid_to DATE,
  lookup_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revenue_response JSONB
);

-- ============================================================
-- 4. TABLE: revenue_credentials — ROS digital cert details
-- ============================================================
CREATE TABLE revenue_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  ros_cert_serial TEXT,
  employer_reg_number TEXT,
  tax_registration_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  test_mode BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ALTER invoices — add RCT columns
-- ============================================================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_rct BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rct_rate NUMERIC(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rct_amount NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rct_net_amount NUMERIC(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rct_deduction_ref TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS rct_contract_id UUID REFERENCES rct_contracts(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_reverse_charge_vat BOOLEAN DEFAULT FALSE;

-- (subcontractors columns already included in CREATE TABLE above)

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX idx_rct_contracts_user ON rct_contracts(user_id);
CREATE INDEX idx_rct_contracts_contract_ref ON rct_contracts(contract_ref);
CREATE INDEX idx_rct_contracts_status ON rct_contracts(status);
CREATE INDEX idx_rct_contracts_principal_tax_ref ON rct_contracts(principal_tax_ref);

CREATE INDEX idx_rct_payment_notifications_user ON rct_payment_notifications(user_id);
CREATE INDEX idx_rct_payment_notifications_contract ON rct_payment_notifications(contract_id);
CREATE INDEX idx_rct_payment_notifications_subcontractor ON rct_payment_notifications(subcontractor_id);
CREATE INDEX idx_rct_payment_notifications_invoice ON rct_payment_notifications(invoice_id);
CREATE INDEX idx_rct_payment_notifications_status ON rct_payment_notifications(status);
CREATE INDEX idx_rct_payment_notifications_payment_date ON rct_payment_notifications(payment_date);

CREATE INDEX idx_rct_rate_lookups_user ON rct_rate_lookups(user_id);
CREATE INDEX idx_rct_rate_lookups_subcontractor ON rct_rate_lookups(subcontractor_id);
CREATE INDEX idx_rct_rate_lookups_tax_ref ON rct_rate_lookups(tax_reference);

CREATE INDEX idx_revenue_credentials_user ON revenue_credentials(user_id);

-- Partial indexes on new invoice columns
CREATE INDEX idx_invoices_rct ON invoices(rct_contract_id) WHERE is_rct = TRUE;
-- subcontractors verified index already in CREATE TABLE block above

-- ============================================================
-- 8. ENABLE RLS
-- ============================================================
ALTER TABLE rct_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rct_payment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rct_rate_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_credentials ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 9. RLS POLICIES: user can manage own records
-- ============================================================

-- rct_contracts
CREATE POLICY "Users manage own rct_contracts" ON rct_contracts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- rct_payment_notifications
CREATE POLICY "Users manage own rct_payment_notifications" ON rct_payment_notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- rct_rate_lookups
CREATE POLICY "Users manage own rct_rate_lookups" ON rct_rate_lookups FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- revenue_credentials
CREATE POLICY "Users manage own revenue_credentials" ON revenue_credentials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 10. RLS POLICIES: accountant access via accountant_clients
-- ============================================================

-- rct_contracts
CREATE POLICY "Accountants see client rct_contracts" ON rct_contracts FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_contracts.user_id)
);
CREATE POLICY "Accountants manage client rct_contracts" ON rct_contracts FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_contracts.user_id)
);

-- rct_payment_notifications
CREATE POLICY "Accountants see client rct_payment_notifications" ON rct_payment_notifications FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_payment_notifications.user_id)
);
CREATE POLICY "Accountants manage client rct_payment_notifications" ON rct_payment_notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_payment_notifications.user_id)
);

-- rct_rate_lookups
CREATE POLICY "Accountants see client rct_rate_lookups" ON rct_rate_lookups FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_rate_lookups.user_id)
);
CREATE POLICY "Accountants manage client rct_rate_lookups" ON rct_rate_lookups FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = rct_rate_lookups.user_id)
);

-- revenue_credentials
CREATE POLICY "Accountants see client revenue_credentials" ON revenue_credentials FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = revenue_credentials.user_id)
);
CREATE POLICY "Accountants manage client revenue_credentials" ON revenue_credentials FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = revenue_credentials.user_id)
);

-- ============================================================
-- 11. TRIGGERS: updated_at
-- ============================================================
CREATE TRIGGER update_rct_contracts_updated_at
  BEFORE UPDATE ON rct_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_revenue_credentials_updated_at
  BEFORE UPDATE ON revenue_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
