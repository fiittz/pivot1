-- Add payment_method to invoices for cash/card/bank tracking
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'cash', 'card', 'cheque', 'direct_debit', 'other'));

-- Add is_cash flag to accounts for quick identification
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_cash BOOLEAN NOT NULL DEFAULT false;

-- Add a tax_scope column so accountants can mark which accounts belong to CT1 vs Form 11 vs excluded
-- 'ct1' = include in company tax, 'form11' = include in personal tax, 'both' = include in both, 'excluded' = skip
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tax_scope TEXT NOT NULL DEFAULT 'ct1' CHECK (tax_scope IN ('ct1', 'form11', 'both', 'excluded'));
