-- Knowledge the co-pilot has learned from accountant corrections
-- that doesn't exist in the app's built-in rules engine.
-- Examples: "staff night out" treatment, specific BIK rules,
-- industry-specific deductions, edge cases in VAT recovery.

CREATE TABLE IF NOT EXISTS copilot_learned_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,                    -- e.g. "Staff Entertainment"
  rule_description TEXT NOT NULL,            -- plain English explanation
  legislation_ref TEXT,                      -- e.g. "s.81 TCA 1997"
  vat_treatment TEXT,                        -- e.g. "Not recoverable per S.60(2)"
  source_vendor TEXT NOT NULL,               -- vendor that triggered the learning
  source_correction_id UUID,                 -- link to the correction that taught us
  verified BOOLEAN NOT NULL DEFAULT false,   -- accountant can verify in settings
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_learned_rules_unique
  ON copilot_learned_rules (category, source_vendor);
CREATE INDEX IF NOT EXISTS idx_learned_rules_category
  ON copilot_learned_rules (category);

ALTER TABLE copilot_learned_rules ENABLE ROW LEVEL SECURITY;

-- Accountants can read all learned rules
CREATE POLICY "Authenticated users can read learned rules"
  ON copilot_learned_rules FOR SELECT TO authenticated
  USING (true);

-- Service role can manage
CREATE POLICY "Service role manages learned rules"
  ON copilot_learned_rules FOR ALL
  USING (true) WITH CHECK (true);
