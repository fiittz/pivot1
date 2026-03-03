-- Accountant INSERT/UPDATE access on vat_returns
-- Allows accountants to approve and save VAT return figures for their clients.

CREATE POLICY "Accountants can insert client vat_returns"
  ON public.vat_returns FOR INSERT
  WITH CHECK (public.is_accountant_for(user_id));

CREATE POLICY "Accountants can update client vat_returns"
  ON public.vat_returns FOR UPDATE
  USING (public.is_accountant_for(user_id));
