CREATE TABLE onboarding_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('company_details','tax_registration','bank_accounts','prior_year','documents','preferences')),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(accountant_client_id, item_key)
);

ALTER TABLE onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants manage checklist" ON onboarding_checklist_items FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.id = onboarding_checklist_items.accountant_client_id AND ac.accountant_id = auth.uid())
);

-- Function to seed default checklist when a new client is added
CREATE OR REPLACE FUNCTION seed_onboarding_checklist()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO onboarding_checklist_items (accountant_client_id, item_key, label, category, sort_order) VALUES
    (NEW.id, 'company_name', 'Company name confirmed', 'company_details', 1),
    (NEW.id, 'company_number', 'CRO number verified', 'company_details', 2),
    (NEW.id, 'registered_address', 'Registered address confirmed', 'company_details', 3),
    (NEW.id, 'directors_listed', 'All directors listed', 'company_details', 4),
    (NEW.id, 'tax_reg_number', 'Tax registration number', 'tax_registration', 10),
    (NEW.id, 'vat_registered', 'VAT registration status confirmed', 'tax_registration', 11),
    (NEW.id, 'paye_registered', 'PAYE/PRSI registration confirmed', 'tax_registration', 12),
    (NEW.id, 'rct_registered', 'RCT status confirmed', 'tax_registration', 13),
    (NEW.id, 'bank_connected', 'Primary bank account connected', 'bank_accounts', 20),
    (NEW.id, 'bank_feeds_imported', 'Bank feeds imported (current year)', 'bank_accounts', 21),
    (NEW.id, 'prior_year_accounts', 'Prior year accounts uploaded/imported', 'prior_year', 30),
    (NEW.id, 'opening_balances', 'Opening balances entered', 'prior_year', 31),
    (NEW.id, 'prior_year_ct1', 'Prior year CT1 copy received', 'prior_year', 32),
    (NEW.id, 'cert_of_incorporation', 'Certificate of incorporation', 'documents', 40),
    (NEW.id, 'tax_clearance', 'Tax clearance certificate', 'documents', 41),
    (NEW.id, 'engagement_letter', 'Engagement letter signed', 'documents', 42),
    (NEW.id, 'year_end_date', 'Financial year-end date confirmed', 'preferences', 50),
    (NEW.id, 'accounting_method', 'Accounting method confirmed (cash/accrual)', 'preferences', 51),
    (NEW.id, 'reporting_preferences', 'Reporting preferences set', 'preferences', 52);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_seed_onboarding_checklist
  AFTER INSERT ON accountant_clients
  FOR EACH ROW
  EXECUTE FUNCTION seed_onboarding_checklist();
