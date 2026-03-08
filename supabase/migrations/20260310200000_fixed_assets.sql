CREATE TABLE fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  asset_name TEXT NOT NULL,
  asset_category TEXT NOT NULL CHECK (asset_category IN ('land_and_buildings','plant_and_machinery','fixtures_and_fittings','motor_vehicles','computer_equipment','office_equipment')),
  purchase_date DATE NOT NULL,
  purchase_cost NUMERIC(12,2) NOT NULL,
  residual_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  useful_life_years INT NOT NULL DEFAULT 5,
  depreciation_method TEXT NOT NULL DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line','reducing_balance')),
  depreciation_rate NUMERIC(5,2),
  disposal_date DATE,
  disposal_proceeds NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own assets" ON fixed_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Accountants see client assets" ON fixed_assets FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = fixed_assets.user_id)
);
CREATE POLICY "Accountants manage client assets" ON fixed_assets FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = fixed_assets.user_id)
);
CREATE POLICY "Accountants update client assets" ON fixed_assets FOR UPDATE USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = fixed_assets.user_id)
);
