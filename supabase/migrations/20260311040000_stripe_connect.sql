-- Store Stripe Connect account details per client
CREATE TABLE stripe_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  stripe_account_id TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'express' CHECK (account_type IN ('standard', 'express')),
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  business_profile JSONB DEFAULT '{}',
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment records (one per successful payment)
CREATE TABLE stripe_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  invoice_id UUID REFERENCES invoices(id),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  payment_method_type TEXT,
  customer_email TEXT,
  receipt_url TEXT,
  transaction_id UUID REFERENCES transactions(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add Stripe fields to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2);

-- Indexes
CREATE INDEX idx_stripe_accounts_user ON stripe_accounts(user_id);
CREATE INDEX idx_stripe_payments_user ON stripe_payments(user_id);
CREATE INDEX idx_stripe_payments_invoice ON stripe_payments(invoice_id);
CREATE INDEX idx_stripe_payments_intent ON stripe_payments(stripe_payment_intent_id);

-- RLS
ALTER TABLE stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own stripe account" ON stripe_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own stripe account" ON stripe_accounts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own payments" ON stripe_payments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Accountants see client stripe" ON stripe_accounts FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = stripe_accounts.user_id)
);
CREATE POLICY "Accountants see client payments" ON stripe_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM accountant_clients ac WHERE ac.accountant_id = auth.uid() AND ac.client_user_id = stripe_payments.user_id)
);

-- Service role can insert/update (for webhooks)
CREATE POLICY "Service role manages payments" ON stripe_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role manages stripe accounts" ON stripe_accounts FOR UPDATE USING (true) WITH CHECK (true);
