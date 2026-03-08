-- Stores year-end closing balances so they auto-carry-forward as
-- next year's opening balances. Also allows accountants to import
-- a prior year trial balance for new clients.

CREATE TABLE IF NOT EXISTS year_end_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tax_year INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'system', -- 'system' (auto at year-end) | 'accountant_import' | 'client_import'
  imported_by UUID,                      -- who imported it (accountant user_id or client user_id)

  -- Fixed Assets (closing NBV)
  fixed_assets_land_buildings NUMERIC NOT NULL DEFAULT 0,
  fixed_assets_plant_machinery NUMERIC NOT NULL DEFAULT 0,
  fixed_assets_motor_vehicles NUMERIC NOT NULL DEFAULT 0,
  fixed_assets_fixtures_fittings NUMERIC NOT NULL DEFAULT 0,

  -- Current Assets
  stock NUMERIC NOT NULL DEFAULT 0,
  work_in_progress NUMERIC NOT NULL DEFAULT 0,
  debtors NUMERIC NOT NULL DEFAULT 0,
  prepayments NUMERIC NOT NULL DEFAULT 0,
  accrued_income NUMERIC NOT NULL DEFAULT 0,
  cash NUMERIC NOT NULL DEFAULT 0,
  bank_balance NUMERIC NOT NULL DEFAULT 0,
  rct_prepayment NUMERIC NOT NULL DEFAULT 0,

  -- Current Liabilities
  creditors NUMERIC NOT NULL DEFAULT 0,
  accrued_expenses NUMERIC NOT NULL DEFAULT 0,
  deferred_income NUMERIC NOT NULL DEFAULT 0,
  taxation NUMERIC NOT NULL DEFAULT 0,
  bank_overdraft NUMERIC NOT NULL DEFAULT 0,
  directors_loan_current NUMERIC NOT NULL DEFAULT 0,  -- current portion (travel etc)
  vat_liability NUMERIC NOT NULL DEFAULT 0,

  -- Long-term Liabilities
  bank_loans NUMERIC NOT NULL DEFAULT 0,
  directors_loans NUMERIC NOT NULL DEFAULT 0,

  -- Capital & Reserves
  share_capital NUMERIC NOT NULL DEFAULT 100,
  retained_profits NUMERIC NOT NULL DEFAULT 0,

  -- P&L summary (informational — for carry-forward of losses etc)
  turnover NUMERIC,
  cost_of_sales NUMERIC,
  gross_profit NUMERIC,
  total_expenses NUMERIC,
  net_profit NUMERIC,
  losses_forward NUMERIC NOT NULL DEFAULT 0,    -- losses carried forward to next year
  capital_allowances_claimed NUMERIC NOT NULL DEFAULT 0,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One snapshot per user per year
CREATE UNIQUE INDEX IF NOT EXISTS idx_year_end_snapshots_unique
  ON year_end_snapshots (user_id, tax_year);

CREATE INDEX IF NOT EXISTS idx_year_end_snapshots_user
  ON year_end_snapshots (user_id);

ALTER TABLE year_end_snapshots ENABLE ROW LEVEL SECURITY;

-- Clients can read/write their own snapshots
CREATE POLICY "Users can manage own snapshots"
  ON year_end_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Accountants can read/write their clients' snapshots
CREATE POLICY "Accountants can manage client snapshots"
  ON year_end_snapshots FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.client_user_id = year_end_snapshots.user_id
        AND ac.accountant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.client_user_id = year_end_snapshots.user_id
        AND ac.accountant_id = auth.uid()
    )
  );

-- Service role can manage all
CREATE POLICY "Service role manages snapshots"
  ON year_end_snapshots FOR ALL
  USING (true) WITH CHECK (true);
