-- Extend employees table with fields required for proper Irish PAYE payroll
-- Date of birth, gender, address, tax basis, bank details, employment ID

ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Address fields (required for payslips and Revenue reporting)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS county TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS eircode TEXT;

-- Tax basis: how PAYE is calculated (cumulative is default, week1/month1 for new starters without RPN)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_basis TEXT NOT NULL DEFAULT 'cumulative'
  CHECK (tax_basis IN ('cumulative', 'week1_month1', 'emergency'));

-- Bank details for salary payment
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_iban TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_bic TEXT;

-- Revenue employment ID (assigned by Revenue for PSR submissions)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_id TEXT;
