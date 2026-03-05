-- Phase 7: Accountant Corrections & Learning System
-- Captures accountant corrections with rich context (industry, business type, amount range)
-- to build a shared knowledge base that improves categorisation for all users over time.

-- ────────────────────────────────────────────
-- 1. Accountant corrections table
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accountant_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who made the correction
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practice_id UUID NOT NULL REFERENCES accountant_practices(id) ON DELETE CASCADE,

  -- Which client's transaction
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,

  -- What was changed
  vendor_pattern TEXT NOT NULL,
  transaction_description TEXT NOT NULL,
  original_category TEXT,
  original_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  corrected_category TEXT NOT NULL,
  corrected_category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  original_vat_rate NUMERIC,
  corrected_vat_rate NUMERIC,

  -- Context for pattern learning
  client_industry TEXT,
  client_business_type TEXT,  -- sole_trader, limited_company, partnership
  transaction_amount NUMERIC,
  transaction_type TEXT,      -- income / expense

  -- Learning metadata
  correction_count INTEGER NOT NULL DEFAULT 1,
  promoted_to_global BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups during categorisation
CREATE INDEX idx_acct_corrections_vendor ON accountant_corrections (vendor_pattern);
CREATE INDEX idx_acct_corrections_accountant ON accountant_corrections (accountant_id);
CREATE INDEX idx_acct_corrections_client ON accountant_corrections (client_user_id);
CREATE INDEX idx_acct_corrections_industry ON accountant_corrections (client_industry, vendor_pattern);

-- Unique constraint: one correction record per accountant + vendor + client industry
CREATE UNIQUE INDEX idx_acct_corrections_unique
  ON accountant_corrections (accountant_id, vendor_pattern, COALESCE(client_industry, ''));

-- ────────────────────────────────────────────
-- 2. Vendor intelligence view (aggregated)
-- ────────────────────────────────────────────

CREATE OR REPLACE VIEW vendor_intelligence AS
SELECT
  vendor_pattern,
  corrected_category,
  corrected_category_id,
  corrected_vat_rate,
  client_industry,
  COUNT(DISTINCT accountant_id) AS accountant_count,
  SUM(correction_count) AS total_corrections,
  -- Confidence: more accountants agreeing = higher confidence
  CASE
    WHEN COUNT(DISTINCT accountant_id) >= 3 THEN 97
    WHEN COUNT(DISTINCT accountant_id) >= 2 THEN 93
    ELSE 90
  END AS confidence,
  MAX(updated_at) AS last_updated
FROM accountant_corrections
GROUP BY
  vendor_pattern,
  corrected_category,
  corrected_category_id,
  corrected_vat_rate,
  client_industry;

-- ────────────────────────────────────────────
-- 3. RLS policies
-- ────────────────────────────────────────────

ALTER TABLE accountant_corrections ENABLE ROW LEVEL SECURITY;

-- Accountants can manage their own corrections
CREATE POLICY "accountant_corrections_select"
  ON accountant_corrections FOR SELECT
  TO authenticated
  USING (accountant_id = auth.uid());

CREATE POLICY "accountant_corrections_insert"
  ON accountant_corrections FOR INSERT
  TO authenticated
  WITH CHECK (accountant_id = auth.uid());

CREATE POLICY "accountant_corrections_update"
  ON accountant_corrections FOR UPDATE
  TO authenticated
  USING (accountant_id = auth.uid());

-- ────────────────────────────────────────────
-- 4. Function: promote high-confidence corrections to global vendor_cache
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION promote_accountant_corrections()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  promoted_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- Find corrections where 2+ accountants agree on the same vendor+category
  FOR rec IN
    SELECT
      vi.vendor_pattern,
      vi.corrected_category,
      vi.corrected_category_id,
      vi.corrected_vat_rate,
      vi.confidence,
      vi.client_industry
    FROM vendor_intelligence vi
    WHERE vi.accountant_count >= 2
      AND NOT EXISTS (
        SELECT 1 FROM vendor_cache vc
        WHERE vc.vendor_pattern = vi.vendor_pattern
          AND vc.user_id IS NULL
          AND vc.source = 'accountant'
      )
  LOOP
    -- Insert as global vendor_cache entry (user_id IS NULL = global)
    INSERT INTO vendor_cache (
      vendor_pattern, normalized_name, category, vat_type, vat_deductible,
      business_purpose, confidence, source, user_id, hit_count, last_seen
    ) VALUES (
      rec.vendor_pattern,
      rec.vendor_pattern,
      rec.corrected_category,
      CASE
        WHEN rec.corrected_vat_rate = 23 THEN 'Standard 23%'
        WHEN rec.corrected_vat_rate = 13.5 THEN 'Reduced 13.5%'
        WHEN rec.corrected_vat_rate = 9 THEN 'Second Reduced 9%'
        WHEN rec.corrected_vat_rate = 0 THEN 'Zero'
        ELSE 'N/A'
      END,
      COALESCE(rec.corrected_vat_rate, 0) > 0,
      FORMAT('Accountant-verified (%s accountants, %s confidence). Industry: %s',
             (SELECT COUNT(DISTINCT accountant_id) FROM accountant_corrections
              WHERE vendor_pattern = rec.vendor_pattern
                AND corrected_category = rec.corrected_category),
             rec.confidence,
             COALESCE(rec.client_industry, 'general')),
      rec.confidence,
      'accountant',
      NULL,  -- global entry
      0,
      NOW()
    )
    ON CONFLICT (vendor_pattern, user_id) DO UPDATE SET
      category = EXCLUDED.category,
      vat_type = EXCLUDED.vat_type,
      vat_deductible = EXCLUDED.vat_deductible,
      business_purpose = EXCLUDED.business_purpose,
      confidence = EXCLUDED.confidence,
      last_seen = NOW();

    -- Mark source corrections as promoted
    UPDATE accountant_corrections
    SET promoted_to_global = TRUE, promoted_at = NOW()
    WHERE vendor_pattern = rec.vendor_pattern
      AND corrected_category = rec.corrected_category
      AND NOT promoted_to_global;

    promoted_count := promoted_count + 1;
  END LOOP;

  RETURN promoted_count;
END;
$$;

-- ────────────────────────────────────────────
-- 5. Updated timestamp trigger
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_accountant_corrections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accountant_corrections_updated_at
  BEFORE UPDATE ON accountant_corrections
  FOR EACH ROW
  EXECUTE FUNCTION update_accountant_corrections_updated_at();
