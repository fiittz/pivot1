-- Direct Messages between accountants and their clients
-- Enables real-time chat within an accountant-client relationship.

-- ============================================================
-- 1. TABLE: direct_messages
-- ============================================================
CREATE TABLE public.direct_messages (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  sender_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role          TEXT NOT NULL CHECK (sender_role IN ('accountant', 'client')),
  content              TEXT NOT NULL,
  is_read              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. INDEX
-- ============================================================
CREATE INDEX idx_direct_messages_conversation
  ON public.direct_messages(accountant_client_id, created_at DESC);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Accountants can view messages for their clients
CREATE POLICY "Accountants can view messages for their clients"
  ON public.direct_messages FOR SELECT
  USING (
    accountant_client_id IN (
      SELECT id FROM public.accountant_clients WHERE accountant_id = auth.uid()
    )
  );

-- Clients can view their own messages
CREATE POLICY "Clients can view their own messages"
  ON public.direct_messages FOR SELECT
  USING (
    accountant_client_id IN (
      SELECT id FROM public.accountant_clients WHERE client_user_id = auth.uid()
    )
  );

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Recipients can mark messages as read
CREATE POLICY "Recipients can mark messages as read"
  ON public.direct_messages FOR UPDATE
  USING (
    sender_id != auth.uid()
    AND accountant_client_id IN (
      SELECT id FROM public.accountant_clients
      WHERE accountant_id = auth.uid() OR client_user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
