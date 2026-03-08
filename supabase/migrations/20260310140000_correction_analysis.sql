-- Add analysis column to accountant_corrections for storing
-- the diagnostic agent's root cause analysis
ALTER TABLE accountant_corrections
  ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT NULL;

-- Index for finding unanalysed corrections
CREATE INDEX IF NOT EXISTS idx_corrections_unanalysed
  ON accountant_corrections (created_at DESC) WHERE analysis IS NULL;
