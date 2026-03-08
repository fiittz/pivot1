-- Audit trail: tracks every data change for compliance and accountability.

CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),          -- whose data changed
  actor_id UUID NOT NULL REFERENCES auth.users(id),         -- who made the change
  actor_role TEXT NOT NULL CHECK (actor_role IN ('client', 'accountant', 'system')),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'transaction', 'category', 'journal_entry', 'vat_rate', 'filing', 'correction'
  )),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reverse')),
  field_name TEXT,           -- which field changed (nullable for create/delete)
  old_value TEXT,
  new_value TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_entity_type
  ON audit_trail (user_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_audit_trail_entity_id
  ON audit_trail (entity_id);

ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Clients can read their own audit trail
CREATE POLICY "Clients can read own audit trail"
  ON audit_trail FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Accountants can read audit trail for their clients
CREATE POLICY "Accountants can read client audit trail"
  ON audit_trail FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM accountant_clients ac
      WHERE ac.client_user_id = audit_trail.user_id
        AND ac.accountant_id = auth.uid()
        AND ac.status = 'active'
    )
  );

-- Service role can insert (for system-level audit events)
CREATE POLICY "Service role manages audit trail"
  ON audit_trail FOR ALL
  USING (true) WITH CHECK (true);

-- Authenticated users can insert audit events (for client/accountant actions)
CREATE POLICY "Authenticated users can insert audit events"
  ON audit_trail FOR INSERT TO authenticated
  WITH CHECK (true);
