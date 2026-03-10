-- Additional employee fields for hourly workers and mid-year starters
-- Hourly rate + normal hours for non-salaried employees
-- Previous employment cumulative figures for mid-year starters (P45 values)

-- Pay type: salaried or hourly
ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_type TEXT NOT NULL DEFAULT 'salaried'
  CHECK (pay_type IN ('salaried', 'hourly'));

-- Hourly rate and normal weekly hours (used when pay_type = 'hourly')
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS normal_hours_per_week NUMERIC(5,2);

-- Previous employment cumulative figures (from P45 / RPN for mid-year starters)
-- These seed the cumulative basis calculation when employee joins mid-year
ALTER TABLE employees ADD COLUMN IF NOT EXISTS prev_employment_gross NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS prev_employment_tax NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS prev_employment_usc NUMERIC(12,2) DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS prev_employment_prsi NUMERIC(12,2) DEFAULT 0;
