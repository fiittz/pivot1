-- Transaction matching engine: vendor rules and match suggestions
-- vendor_rules: learned patterns from confirmed categorizations
-- match_suggestions: suggested matches for review

-- ============================================================
-- 1. vendor_rules
-- ============================================================
CREATE TABLE vendor_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vendor_pattern TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  category_name TEXT NOT NULL,
  account_type TEXT,
  avg_amount NUMERIC(12,2),
  min_amount NUMERIC(12,2),
  max_amount NUMERIC(12,2),
  confirmation_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, vendor_pattern)
);

CREATE INDEX idx_vendor_rules_user ON vendor_rules(user_id);
CREATE INDEX idx_vendor_rules_pattern ON vendor_rules(vendor_pattern);

-- ============================================================
-- 2. match_suggestions
-- ============================================================
CREATE TABLE match_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL CHECK (match_type IN ('transfer', 'invoice', 'payroll', 'vendor_rule', 'uncategorised')),
  confidence INT NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  suggested_category_id UUID REFERENCES categories(id),
  suggested_category_name TEXT,
  matched_invoice_id UUID REFERENCES invoices(id),
  matched_transfer_transaction_id UUID REFERENCES transactions(id),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_match_suggestions_user_status ON match_suggestions(user_id, status);
CREATE INDEX idx_match_suggestions_transaction ON match_suggestions(transaction_id);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE vendor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;

-- Users manage their own vendor rules
CREATE POLICY "Users can manage own vendor_rules"
  ON vendor_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Accountants can view client vendor rules
CREATE POLICY "Accountants can view client vendor_rules"
  ON vendor_rules FOR SELECT
  USING (public.is_accountant_for(user_id));

-- Accountants can manage client vendor rules
CREATE POLICY "Accountants can manage client vendor_rules"
  ON vendor_rules FOR ALL
  USING (public.is_accountant_for(user_id))
  WITH CHECK (public.is_accountant_for(user_id));

-- Users manage their own match suggestions
CREATE POLICY "Users can manage own match_suggestions"
  ON match_suggestions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Accountants can view client match suggestions
CREATE POLICY "Accountants can view client match_suggestions"
  ON match_suggestions FOR SELECT
  USING (public.is_accountant_for(user_id));

-- Accountants can manage client match suggestions
CREATE POLICY "Accountants can manage client match_suggestions"
  ON match_suggestions FOR ALL
  USING (public.is_accountant_for(user_id))
  WITH CHECK (public.is_accountant_for(user_id));

-- ============================================================
-- 4. updated_at trigger on vendor_rules
-- ============================================================
CREATE TRIGGER update_vendor_rules_updated_at
  BEFORE UPDATE ON vendor_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
