-- Phase 2-4: Inbound Email, Receipt Chaser & Period-End Questionnaire System

-- ────────────────────────────────────────────
-- 1. Inbound email code on accountant_clients
-- ────────────────────────────────────────────

ALTER TABLE accountant_clients
  ADD COLUMN IF NOT EXISTS inbound_email_code TEXT UNIQUE
    DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

UPDATE accountant_clients
SET inbound_email_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
WHERE inbound_email_code IS NULL;

ALTER TABLE accountant_clients
  ALTER COLUMN inbound_email_code SET NOT NULL;

CREATE INDEX idx_ac_inbound_email ON accountant_clients (inbound_email_code);

-- ────────────────────────────────────────────
-- 2. Inbound emails log
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID REFERENCES accountant_clients(id) ON DELETE SET NULL,
  client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  practice_id UUID REFERENCES accountant_practices(id) ON DELETE SET NULL,

  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,

  -- Resend metadata
  resend_email_id TEXT,

  -- Processing pipeline
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'triaging', 'extracting', 'enriching',
                      'processed', 'ignored', 'failed', 'unmatched')),
  triage_classification TEXT
    CHECK (triage_classification IN (
      'invoice', 'receipt', 'credit_note', 'statement',
      'bank_notice', 'personal', 'spam', 'newsletter', 'other'
    )),
  triage_confidence NUMERIC,

  -- Attachments in Supabase Storage
  attachment_count INTEGER DEFAULT 0,
  attachment_paths TEXT[] DEFAULT '{}',

  -- Extraction results (populated by Stage 3)
  extracted_data JSONB,
  extraction_confidence NUMERIC,

  -- Enrichment results (populated by Stage 4)
  matched_transaction_id UUID,
  assigned_category TEXT,
  assigned_category_id UUID,
  assigned_vat_rate NUMERIC,
  enrichment_confidence NUMERIC,

  -- Final routing (populated by Stage 5)
  route TEXT CHECK (route IN ('auto_filed', 'pending_review', 'accountant_queue')),
  receipt_id UUID,

  -- Dedup
  document_hash TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Prevent duplicate processing of same Resend email
  CONSTRAINT inbound_emails_resend_unique UNIQUE (resend_email_id)
);

CREATE INDEX idx_inbound_emails_client ON inbound_emails (accountant_client_id);
CREATE INDEX idx_inbound_emails_status ON inbound_emails (status);
CREATE INDEX idx_inbound_emails_practice ON inbound_emails (practice_id);
CREATE INDEX idx_inbound_emails_hash ON inbound_emails (document_hash) WHERE document_hash IS NOT NULL;

ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inbound_emails_accountant_select"
  ON inbound_emails FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.id = inbound_emails.accountant_client_id
        AND ac.accountant_id = auth.uid()
    )
    OR practice_id IN (
      SELECT id FROM accountant_practices WHERE owner_id = auth.uid()
    )
  );

-- Clients can see their own inbound emails
CREATE POLICY "inbound_emails_client_select"
  ON inbound_emails FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

-- ────────────────────────────────────────────
-- 3. Notification queue
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,

  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'receipt_chase', 'period_end_questionnaire', 'document_request_reminder',
      'filing_ready', 'filing_approved', 'inbound_email_review', 'general'
    )),

  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,

  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,

  -- Dedup key prevents sending the same notification twice
  dedup_key TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_pending ON notification_queue (status, scheduled_for)
  WHERE status = 'pending';
CREATE UNIQUE INDEX idx_notif_dedup
  ON notification_queue (dedup_key) WHERE dedup_key IS NOT NULL AND status = 'pending';

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_user_select"
  ON notification_queue FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

-- ────────────────────────────────────────────
-- 4. Period-end questionnaires
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS period_end_questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES accountant_clients(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accountant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  period_type TEXT NOT NULL CHECK (period_type IN ('vat_period', 'year_end')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'started', 'completed', 'reviewed')),
  sent_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,

  -- Pre-filled from onboarding, updated by client
  responses JSONB DEFAULT '{
    "new_assets_over_1000": null,
    "new_assets_details": null,
    "new_loans_or_finance": null,
    "new_loans_details": null,
    "staff_changes": null,
    "staff_changes_details": null,
    "personal_card_business_expenses": null,
    "personal_card_details": null,
    "income_outside_bank": null,
    "income_outside_details": null,
    "other_notes": null
  }',

  accountant_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_peq_client ON period_end_questionnaires (client_user_id, period_end);
CREATE INDEX idx_peq_accountant ON period_end_questionnaires (accountant_id, status);
CREATE UNIQUE INDEX idx_peq_unique
  ON period_end_questionnaires (accountant_client_id, period_type, period_end);

ALTER TABLE period_end_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "peq_client_select"
  ON period_end_questionnaires FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY "peq_client_update"
  ON period_end_questionnaires FOR UPDATE TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY "peq_accountant_all"
  ON period_end_questionnaires FOR ALL TO authenticated
  USING (accountant_id = auth.uid());

-- ────────────────────────────────────────────
-- 5. Receipt chase log
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS receipt_chase_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accountant_client_id UUID REFERENCES accountant_clients(id) ON DELETE SET NULL,

  chase_number INTEGER NOT NULL DEFAULT 1,
  notification_id UUID REFERENCES notification_queue(id),
  escalated_to_accountant BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chase_txn ON receipt_chase_log (transaction_id);
CREATE INDEX idx_chase_client ON receipt_chase_log (client_user_id);

ALTER TABLE receipt_chase_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chase_client_select"
  ON receipt_chase_log FOR SELECT TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY "chase_accountant_select"
  ON receipt_chase_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.id = receipt_chase_log.accountant_client_id
        AND ac.accountant_id = auth.uid()
    )
  );
