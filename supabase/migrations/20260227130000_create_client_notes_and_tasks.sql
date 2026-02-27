-- Phase 4: CRM Features — Client Notes + Tasks
-- Creates client_notes and client_tasks tables with RLS scoped to accountant_id.

-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status  AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- ============================================================
-- 2. client_notes
-- ============================================================
CREATE TABLE public.client_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  accountant_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL DEFAULT '',
  is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants manage own notes"
  ON public.client_notes FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

CREATE INDEX idx_client_notes_accountant_client
  ON public.client_notes(accountant_client_id, created_at DESC);

CREATE INDEX idx_client_notes_accountant
  ON public.client_notes(accountant_id);

-- Auto-update updated_at
CREATE TRIGGER set_client_notes_updated_at
  BEFORE UPDATE ON public.client_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. client_tasks
-- ============================================================
CREATE TABLE public.client_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_client_id UUID NOT NULL REFERENCES public.accountant_clients(id) ON DELETE CASCADE,
  accountant_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  priority        public.task_priority NOT NULL DEFAULT 'medium',
  status          public.task_status NOT NULL DEFAULT 'todo',
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  category        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accountants manage own tasks"
  ON public.client_tasks FOR ALL
  USING (accountant_id = auth.uid())
  WITH CHECK (accountant_id = auth.uid());

-- Cross-client queries: all tasks for an accountant, ordered by due date
CREATE INDEX idx_client_tasks_accountant_status
  ON public.client_tasks(accountant_id, status, due_date);

-- Per-client queries
CREATE INDEX idx_client_tasks_accountant_client
  ON public.client_tasks(accountant_client_id, status, created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER set_client_tasks_updated_at
  BEFORE UPDATE ON public.client_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
