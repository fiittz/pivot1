-- Phase 3: Accountant Client Data Access
-- Creates is_accountant_for() SECURITY DEFINER function and adds
-- SELECT-only RLS policies to all existing user-scoped tables.

-- ============================================================
-- 1. FUNCTION: is_accountant_for(target_user_id)
-- Returns TRUE if the calling user is an active accountant for the given client.
-- SECURITY DEFINER so it can read accountant_clients regardless of caller's RLS.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_accountant_for(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
STABLE  -- cacheable within a transaction
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.accountant_clients
    WHERE accountant_id = auth.uid()
      AND client_user_id = target_user_id
      AND status = 'active'
  );
END;
$$;

-- ============================================================
-- 2. SELECT-only RLS policies for accountant access
-- Existing owner policies remain untouched.
-- ============================================================

-- transactions
CREATE POLICY "Accountants can view client transactions"
  ON public.transactions FOR SELECT
  USING (public.is_accountant_for(user_id));

-- categories
CREATE POLICY "Accountants can view client categories"
  ON public.categories FOR SELECT
  USING (public.is_accountant_for(user_id));

-- customers
CREATE POLICY "Accountants can view client customers"
  ON public.customers FOR SELECT
  USING (public.is_accountant_for(user_id));

-- suppliers
CREATE POLICY "Accountants can view client suppliers"
  ON public.suppliers FOR SELECT
  USING (public.is_accountant_for(user_id));

-- invoices
CREATE POLICY "Accountants can view client invoices"
  ON public.invoices FOR SELECT
  USING (public.is_accountant_for(user_id));

-- invoice_items (user_id is on parent invoice, join through invoice_id)
-- invoice_items don't have user_id directly; they're accessed via invoice joins.
-- Since the invoice SELECT policy gates access, Supabase nested selects will work.

-- expenses
CREATE POLICY "Accountants can view client expenses"
  ON public.expenses FOR SELECT
  USING (public.is_accountant_for(user_id));

-- accounts
CREATE POLICY "Accountants can view client accounts"
  ON public.accounts FOR SELECT
  USING (public.is_accountant_for(user_id));

-- vat_returns
CREATE POLICY "Accountants can view client vat_returns"
  ON public.vat_returns FOR SELECT
  USING (public.is_accountant_for(user_id));

-- subcontractors (created later if RCT feature is enabled)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subcontractors') THEN
    EXECUTE 'CREATE POLICY "Accountants can view client subcontractors" ON public.subcontractors FOR SELECT USING (public.is_accountant_for(user_id))';
  END IF;
END $$;

-- rct_contracts (created later if RCT feature is enabled)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rct_contracts') THEN
    EXECUTE 'CREATE POLICY "Accountants can view client rct_contracts" ON public.rct_contracts FOR SELECT USING (public.is_accountant_for(user_id))';
  END IF;
END $$;

-- rct_deductions (created later if RCT feature is enabled)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rct_deductions') THEN
    EXECUTE 'CREATE POLICY "Accountants can view client rct_deductions" ON public.rct_deductions FOR SELECT USING (public.is_accountant_for(user_id))';
  END IF;
END $$;

-- director_onboarding
CREATE POLICY "Accountants can view client director_onboarding"
  ON public.director_onboarding FOR SELECT
  USING (public.is_accountant_for(user_id));

-- onboarding_settings
CREATE POLICY "Accountants can view client onboarding_settings"
  ON public.onboarding_settings FOR SELECT
  USING (public.is_accountant_for(user_id));

-- receipts
CREATE POLICY "Accountants can view client receipts"
  ON public.receipts FOR SELECT
  USING (public.is_accountant_for(user_id));

-- audit_log (may not exist on all deployments)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_log') THEN
    EXECUTE 'CREATE POLICY "Accountants can view client audit_log" ON public.audit_log FOR SELECT USING (public.is_accountant_for(user_id))';
  END IF;
END $$;

-- import_batches
CREATE POLICY "Accountants can view client import_batches"
  ON public.import_batches FOR SELECT
  USING (public.is_accountant_for(user_id));

-- profiles (accountant needs to see client's business name etc.)
CREATE POLICY "Accountants can view client profiles"
  ON public.profiles FOR SELECT
  USING (public.is_accountant_for(id));

-- ============================================================
-- 3. INDEX for fast is_accountant_for() lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_accountant_clients_active_lookup
  ON public.accountant_clients(accountant_id, client_user_id)
  WHERE status = 'active';
