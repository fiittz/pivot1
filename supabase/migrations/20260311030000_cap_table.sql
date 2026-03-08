-- Share classes
CREATE TABLE share_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  class_name TEXT NOT NULL DEFAULT 'Ordinary',
  nominal_value NUMERIC(10,4) NOT NULL DEFAULT 1.00,
  voting_rights BOOLEAN NOT NULL DEFAULT true,
  dividend_rights BOOLEAN NOT NULL DEFAULT true,
  currency TEXT NOT NULL DEFAULT 'EUR',
  total_authorised INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, class_name)
);

-- Shareholders
CREATE TABLE shareholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  shareholder_name TEXT NOT NULL,
  shareholder_type TEXT NOT NULL DEFAULT 'individual' CHECK (shareholder_type IN ('individual', 'company', 'trust', 'nominee')),
  ppsn TEXT,
  company_number TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  is_director BOOLEAN NOT NULL DEFAULT false,
  employee_id UUID REFERENCES employees(id),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Share allocations (who holds how many of which class)
CREATE TABLE share_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  shareholder_id UUID NOT NULL REFERENCES shareholders(id) ON DELETE CASCADE,
  share_class_id UUID NOT NULL REFERENCES share_classes(id) ON DELETE CASCADE,
  num_shares INT NOT NULL,
  date_acquired DATE NOT NULL,
  acquisition_type TEXT NOT NULL DEFAULT 'incorporation' CHECK (acquisition_type IN ('incorporation', 'allotment', 'transfer_in', 'bonus_issue')),
  price_per_share NUMERIC(10,4) NOT NULL DEFAULT 1.00,
  total_consideration NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_disposed DATE,
  disposal_type TEXT CHECK (disposal_type IN ('transfer_out', 'buyback', 'cancellation')),
  transferred_to UUID REFERENCES shareholders(id),
  certificate_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shareholders_user ON shareholders(user_id);
CREATE INDEX idx_share_alloc_user ON share_allocations(user_id);
CREATE INDEX idx_share_alloc_holder ON share_allocations(shareholder_id);

-- RLS
ALTER TABLE share_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own share_classes" ON share_classes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own shareholders" ON shareholders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users see own allocations" ON share_allocations FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Accountants see client share_classes" ON share_classes FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = share_classes.user_id)
);
CREATE POLICY "Accountants manage client share_classes" ON share_classes FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = share_classes.user_id)
);

CREATE POLICY "Accountants see client shareholders" ON shareholders FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = shareholders.user_id)
);
CREATE POLICY "Accountants manage client shareholders" ON shareholders FOR INSERT WITH CHECK (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = shareholders.user_id)
);
CREATE POLICY "Accountants update client shareholders" ON shareholders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = shareholders.user_id)
);

CREATE POLICY "Accountants see client allocations" ON share_allocations FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = share_allocations.user_id)
);
CREATE POLICY "Accountants manage client allocations" ON share_allocations FOR ALL USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = share_allocations.user_id)
);
