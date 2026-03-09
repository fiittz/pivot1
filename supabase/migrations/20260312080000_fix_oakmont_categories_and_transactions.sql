-- ============================================================================
-- FIX: Seed Oakmont categories in SQL so transactions can be created
--
-- The original seed migration (20260312020000) failed silently because
-- categories are normally created client-side via seedCategories.ts.
-- This migration seeds the required categories directly, then re-runs
-- the transaction seed.
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  -- Category IDs
  v_cat_contract_work UUID;
  v_cat_labour UUID;
  v_cat_materials_charged UUID;
  v_cat_materials UUID;
  v_cat_subcontractor UUID;
  v_cat_tools UUID;
  v_cat_motor UUID;
  v_cat_fuel UUID;
  v_cat_insurance UUID;
  v_cat_prof_fees UUID;
  v_cat_phone UUID;
  v_cat_bank UUID;
  v_cat_training UUID;
  v_cat_advertising UUID;
  v_cat_travel UUID;
  v_cat_meals UUID;
  v_cat_protective UUID;
  v_cat_director_rem UUID;
  v_cat_sundry UUID;
  v_cat_rent UUID;
  v_cat_light UUID;
  v_cat_repairs UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jamie@oakmont.ie';
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'jamie@oakmont.ie not found — skipping';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 1. SEED CATEGORIES (Construction/Carpentry industry)
  -- ══════════════════════════════════════════════════════════════

  -- Income categories
  INSERT INTO public.categories (user_id, name, type, account_code, vat_rate, account_type)
  VALUES
    (v_user_id, 'Contract Work', 'income', '4100', 23, 'business'),
    (v_user_id, 'Labour Income', 'income', '4200', 23, 'business'),
    (v_user_id, 'Materials Charged', 'income', '4300', 23, 'business'),
    (v_user_id, 'Consultation Fees', 'income', '4400', 23, 'business'),
    (v_user_id, 'Other Income', 'income', '4900', 23, 'business')
  ON CONFLICT DO NOTHING;

  -- Expense categories
  INSERT INTO public.categories (user_id, name, type, account_code, vat_rate, account_type)
  VALUES
    (v_user_id, 'Materials & Supplies', 'expense', '5100', 23, 'business'),
    (v_user_id, 'Subcontractor Costs', 'expense', '5200', 23, 'business'),
    (v_user_id, 'Tools & Equipment', 'expense', '5300', 23, 'business'),
    (v_user_id, 'Motor & Travel', 'expense', '5400', 23, 'business'),
    (v_user_id, 'Motor Fuel', 'expense', '5410', 23, 'business'),
    (v_user_id, 'Insurance', 'expense', '5500', 0, 'both'),
    (v_user_id, 'Professional Fees', 'expense', '5600', 23, 'both'),
    (v_user_id, 'Printing, Postage & Stationery', 'expense', '5700', 23, 'business'),
    (v_user_id, 'Telephone & Communications', 'expense', '5710', 23, 'business'),
    (v_user_id, 'Bank Charges', 'expense', '5800', 0, 'both'),
    (v_user_id, 'Rent & Rates', 'expense', '5900', 0, 'business'),
    (v_user_id, 'Light, Heat & Power', 'expense', '5910', 13.5, 'business'),
    (v_user_id, 'Training & Certifications', 'expense', '6000', 0, 'business'),
    (v_user_id, 'Advertising & Marketing', 'expense', '6100', 23, 'business'),
    (v_user_id, 'Travel & Subsistence', 'expense', '6200', 0, 'business'),
    (v_user_id, 'Meals & Entertainment', 'expense', '6300', 0, 'business'),
    (v_user_id, 'Repairs & Maintenance', 'expense', '6400', 23, 'business'),
    (v_user_id, 'Protective Clothing', 'expense', '6500', 23, 'business'),
    (v_user_id, 'Computer Costs', 'expense', '6600', 23, 'business'),
    (v_user_id, 'Director''s Loan Account', 'expense', '6700', 0, 'business'),
    (v_user_id, 'Director''s Remuneration', 'expense', '6710', 0, 'business'),
    (v_user_id, 'Dividends', 'expense', '6720', 0, 'business'),
    (v_user_id, 'Medical Expenses', 'expense', '6800', 0, 'both'),
    (v_user_id, 'Sundry Expenses', 'expense', '6900', 23, 'business')
  ON CONFLICT DO NOTHING;

  -- Personal categories
  INSERT INTO public.categories (user_id, name, type, account_code, vat_rate, account_type)
  VALUES
    (v_user_id, 'Salary from Company', 'income', '3100', 0, 'personal'),
    (v_user_id, 'Dividend Income', 'income', '3200', 0, 'personal'),
    (v_user_id, 'Other Personal Income', 'income', '3900', 0, 'personal'),
    (v_user_id, 'Groceries & Household', 'expense', '7100', 0, 'personal'),
    (v_user_id, 'Rent / Mortgage', 'expense', '7200', 0, 'personal'),
    (v_user_id, 'Pension Contributions', 'expense', '7300', 0, 'personal'),
    (v_user_id, 'Health Insurance', 'expense', '7400', 0, 'personal'),
    (v_user_id, 'Charitable Donations', 'expense', '7500', 0, 'personal'),
    (v_user_id, 'Tuition Fees', 'expense', '7600', 0, 'personal'),
    (v_user_id, 'Childcare', 'expense', '7700', 0, 'personal'),
    (v_user_id, 'Personal Transport', 'expense', '7800', 0, 'personal'),
    (v_user_id, 'Clothing & Personal', 'expense', '7900', 0, 'personal')
  ON CONFLICT DO NOTHING;

  -- Also add the Tax Refund category (used for Revenue refunds)
  INSERT INTO public.categories (user_id, name, type, account_code, vat_rate, account_type)
  VALUES (v_user_id, 'Tax Refund', 'income', '4800', 0, 'business')
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════
  -- 2. LOOK UP CATEGORY IDs
  -- ══════════════════════════════════════════════════════════════
  SELECT id INTO v_cat_contract_work FROM public.categories WHERE user_id = v_user_id AND account_code = '4100' LIMIT 1;
  SELECT id INTO v_cat_labour FROM public.categories WHERE user_id = v_user_id AND account_code = '4200' LIMIT 1;
  SELECT id INTO v_cat_materials_charged FROM public.categories WHERE user_id = v_user_id AND account_code = '4300' LIMIT 1;
  SELECT id INTO v_cat_materials FROM public.categories WHERE user_id = v_user_id AND account_code = '5100' LIMIT 1;
  SELECT id INTO v_cat_subcontractor FROM public.categories WHERE user_id = v_user_id AND account_code = '5200' LIMIT 1;
  SELECT id INTO v_cat_tools FROM public.categories WHERE user_id = v_user_id AND account_code = '5300' LIMIT 1;
  SELECT id INTO v_cat_motor FROM public.categories WHERE user_id = v_user_id AND account_code = '5400' LIMIT 1;
  SELECT id INTO v_cat_fuel FROM public.categories WHERE user_id = v_user_id AND account_code = '5410' LIMIT 1;
  SELECT id INTO v_cat_insurance FROM public.categories WHERE user_id = v_user_id AND account_code = '5500' LIMIT 1;
  SELECT id INTO v_cat_prof_fees FROM public.categories WHERE user_id = v_user_id AND account_code = '5600' LIMIT 1;
  SELECT id INTO v_cat_phone FROM public.categories WHERE user_id = v_user_id AND account_code = '5710' LIMIT 1;
  SELECT id INTO v_cat_bank FROM public.categories WHERE user_id = v_user_id AND account_code = '5800' LIMIT 1;
  SELECT id INTO v_cat_training FROM public.categories WHERE user_id = v_user_id AND account_code = '6000' LIMIT 1;
  SELECT id INTO v_cat_advertising FROM public.categories WHERE user_id = v_user_id AND account_code = '6100' LIMIT 1;
  SELECT id INTO v_cat_travel FROM public.categories WHERE user_id = v_user_id AND account_code = '6200' LIMIT 1;
  SELECT id INTO v_cat_meals FROM public.categories WHERE user_id = v_user_id AND account_code = '6300' LIMIT 1;
  SELECT id INTO v_cat_protective FROM public.categories WHERE user_id = v_user_id AND account_code = '6500' LIMIT 1;
  SELECT id INTO v_cat_director_rem FROM public.categories WHERE user_id = v_user_id AND account_code = '6710' LIMIT 1;
  SELECT id INTO v_cat_sundry FROM public.categories WHERE user_id = v_user_id AND account_code = '6900' LIMIT 1;
  SELECT id INTO v_cat_rent FROM public.categories WHERE user_id = v_user_id AND account_code = '5900' LIMIT 1;
  SELECT id INTO v_cat_light FROM public.categories WHERE user_id = v_user_id AND account_code = '5910' LIMIT 1;
  SELECT id INTO v_cat_repairs FROM public.categories WHERE user_id = v_user_id AND account_code = '6400' LIMIT 1;

  IF v_cat_contract_work IS NULL THEN
    RAISE NOTICE 'Categories still not found — something went wrong';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 3. GET OR CREATE ACCOUNT
  -- ══════════════════════════════════════════════════════════════
  SELECT id INTO v_account_id FROM public.accounts
    WHERE user_id = v_user_id AND is_default = true
    LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (
      user_id, name, account_type, currency, balance,
      is_default, is_cash, iban, bic
    ) VALUES (
      v_user_id, 'Business Current Account', 'limited_company', 'EUR', 34562.18,
      true, false, 'IE29AIBK93115212345678', 'AIBKIE2D'
    ) RETURNING id INTO v_account_id;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 4. CLEAR & RE-SEED 2025 TRANSACTIONS
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-12-31';

  -- INCOME
  INSERT INTO public.transactions (user_id, account_id, category_id, type, amount, description, transaction_date, vat_amount, vat_rate, is_reconciled) VALUES
  (v_user_id, v_account_id, v_cat_labour, 'income', 4200.00, 'O''Brien kitchen — labour week 1-2', '2025-01-20', 554.63, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 6850.00, 'O''Brien kitchen — cabinets & worktops', '2025-01-25', 1281.72, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 3800.00, 'O''Brien kitchen — installation & finishing', '2025-02-10', 501.76, 13.5, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 12500.00, 'McCarthy Builders — Sandyford apt joinery phase 1', '2025-02-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 8750.00, 'McCarthy Builders — Sandyford apt joinery phase 2', '2025-03-25', 0, 0, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 9200.00, 'Dunne Interiors — office reception panelling', '2025-04-15', 1720.16, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 5600.00, 'Dunne Interiors — boardroom fit-out labour', '2025-05-08', 739.56, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 3400.00, 'Dunne Interiors — timber & hardware charged', '2025-05-12', 635.77, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 1850.00, 'Gleeson PM — door replacements Merrion Sq', '2025-04-22', 244.27, 13.5, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 2200.00, 'Gleeson PM — sash window repairs Ranelagh', '2025-06-05', 290.48, 13.5, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 5500.00, 'Murphy kitchen — demolition & prep', '2025-07-07', 726.37, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 8200.00, 'Murphy kitchen — island unit & Silestone worktop', '2025-07-18', 1533.17, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 4800.00, 'Murphy kitchen — installation & tiling prep', '2025-08-05', 633.70, 13.5, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 3200.00, 'Kinsella — bespoke walnut bookcase', '2025-08-20', 598.37, 23, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 2800.00, 'Kinsella — built-in wardrobe system', '2025-09-10', 523.58, 23, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 15000.00, 'McCarthy Builders — Sandyford apt joinery phase 3', '2025-09-30', 0, 0, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 1600.00, 'Gleeson PM — fire door upgrades Ballsbridge', '2025-10-14', 211.24, 13.5, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 7500.00, 'Dunne Interiors — retail shop fit-out Grafton St', '2025-11-08', 1402.44, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 3200.00, 'O''Brien — utility room extension joinery', '2025-11-25', 422.47, 13.5, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 4500.00, 'Gleeson PM — common area refurbishment', '2025-12-10', 841.46, 23, true);

  -- EXPENSES
  INSERT INTO public.transactions (user_id, account_id, category_id, type, amount, description, transaction_date, vat_amount, vat_rate, is_reconciled) VALUES
  (v_user_id, v_account_id, v_cat_materials, 'expense', -1245.00, 'Chadwicks — timber order Jan', '2025-01-12', 232.89, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -890.00, 'Screwfix — hardware & fixings', '2025-01-18', 166.42, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -2340.00, 'Brooks Timber — oak boards O''Brien kitchen', '2025-01-22', 437.56, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -1680.00, 'Quinnsworth Kitchens — cabinet units wholesale', '2025-02-05', 314.15, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -567.50, 'Screwfix — adhesives, sealants, screws', '2025-03-08', 106.12, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -3200.00, 'Chadwicks — bulk timber order Dunne fit-out', '2025-04-10', 598.37, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -945.00, 'Heiton Buckley — plywood sheets', '2025-05-15', 176.71, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -4100.00, 'Quinnsworth — Murphy kitchen units & Silestone', '2025-07-03', 766.67, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -1850.00, 'Brooks Timber — American walnut Kinsella bookcase', '2025-08-12', 345.93, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -780.00, 'Chadwicks — MDF & hardware', '2025-09-05', 145.85, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -1100.00, 'Brooks Timber — fire door blanks Gleeson', '2025-10-08', 205.69, 23, true),
  (v_user_id, v_account_id, v_cat_materials, 'expense', -2650.00, 'Chadwicks — Grafton St fit-out materials', '2025-11-03', 495.53, 23, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -3500.00, 'Dave Byrne Electrics — kitchen wiring O''Brien', '2025-02-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -2800.00, 'Liam Nolan Plumbing — kitchen plumbing O''Brien', '2025-02-18', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -4200.00, 'Dave Byrne Electrics — Dunne office wiring', '2025-05-20', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -2500.00, 'Liam Nolan Plumbing — Murphy kitchen', '2025-07-25', 0, 0, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -189.00, 'Screwfix — drill bits & blades', '2025-01-30', 35.35, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -2450.00, 'DeWalt — DWS780 mitre saw', '2025-03-15', 458.13, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -345.00, 'Festool — sanding pads & accessories', '2025-06-20', 64.51, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -1650.00, 'Makita — track saw system', '2025-09-12', 308.54, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -89.00, 'Stanley — measuring & marking set', '2025-11-15', 16.64, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -210.00, 'Circle K — diesel Jan', '2025-01-31', 39.27, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -195.00, 'Circle K — diesel Feb', '2025-02-28', 36.46, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -220.00, 'Applegreen — diesel Mar', '2025-03-31', 41.14, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -185.00, 'Circle K — diesel Apr', '2025-04-30', 34.59, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -230.00, 'Applegreen — diesel May', '2025-05-31', 43.01, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -200.00, 'Circle K — diesel Jun', '2025-06-30', 37.40, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -215.00, 'Circle K — diesel Jul', '2025-07-31', 40.20, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -195.00, 'Applegreen — diesel Aug', '2025-08-31', 36.46, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -225.00, 'Circle K — diesel Sep', '2025-09-30', 42.07, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -210.00, 'Circle K — diesel Oct', '2025-10-31', 39.27, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -200.00, 'Applegreen — diesel Nov', '2025-11-30', 37.40, 23, true),
  (v_user_id, v_account_id, v_cat_fuel, 'expense', -190.00, 'Circle K — diesel Dec', '2025-12-31', 35.53, 23, true),
  (v_user_id, v_account_id, v_cat_motor, 'expense', -980.00, 'NCT & service — Transit Custom', '2025-03-20', 0, 0, true),
  (v_user_id, v_account_id, v_cat_motor, 'expense', -450.00, 'Halfords — 4 tyres Transit Custom', '2025-08-15', 84.15, 23, true),
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -2400.00, 'Allianz — public liability insurance', '2025-01-05', 0, 0, true),
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -1800.00, 'AIG — employer liability insurance', '2025-01-05', 0, 0, true),
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -1350.00, 'AXA — van insurance renewal', '2025-02-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_prof_fees, 'expense', -1800.00, 'Balnce — annual accounting fee', '2025-06-15', 336.59, 23, true),
  (v_user_id, v_account_id, v_cat_prof_fees, 'expense', -350.00, 'CRO — annual return filing', '2025-09-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Jan', '2025-01-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Feb', '2025-02-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Mar', '2025-03-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Apr', '2025-04-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile May', '2025-05-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Jun', '2025-06-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Jul', '2025-07-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Aug', '2025-08-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Sep', '2025-09-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Oct', '2025-10-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Nov', '2025-11-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_phone, 'expense', -49.99, 'Three — mobile Dec', '2025-12-25', 9.35, 23, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Jan', '2025-01-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Feb', '2025-02-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Mar', '2025-03-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Apr', '2025-04-30', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges May', '2025-05-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Jun', '2025-06-30', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Jul', '2025-07-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Aug', '2025-08-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Sep', '2025-09-30', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Oct', '2025-10-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Nov', '2025-11-30', 0, 0, true),
  (v_user_id, v_account_id, v_cat_bank, 'expense', -18.50, 'AIB — monthly bank charges Dec', '2025-12-31', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — January', '2025-01-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — February', '2025-02-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — March', '2025-03-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — April', '2025-04-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — May', '2025-05-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — June', '2025-06-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — July', '2025-07-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — August', '2025-08-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — September', '2025-09-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — October', '2025-10-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — November', '2025-11-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_director_rem, 'expense', -4000.00, 'Director salary — December', '2025-12-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q1', '2025-01-02', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q2', '2025-04-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q3', '2025-07-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q4', '2025-10-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_training, 'expense', -450.00, 'SOLAS — Safe Pass renewal', '2025-02-20', 0, 0, true),
  (v_user_id, v_account_id, v_cat_training, 'expense', -320.00, 'City & Guilds — kitchen design CPD', '2025-06-10', 0, 0, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Jan', '2025-01-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Feb', '2025-02-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -350.00, 'GoldenPages.ie — annual listing', '2025-03-01', 65.45, 23, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Oct', '2025-10-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_protective, 'expense', -285.00, 'Safety Direct — boots, goggles, hi-vis', '2025-03-05', 53.29, 23, true),
  (v_user_id, v_account_id, v_cat_meals, 'expense', -65.00, 'Avoca — client lunch O''Brien', '2025-02-12', 0, 0, true),
  (v_user_id, v_account_id, v_cat_meals, 'expense', -120.00, 'Chapter One — dinner with McCarthy', '2025-05-22', 0, 0, true),
  (v_user_id, v_account_id, v_cat_meals, 'expense', -45.00, 'Costa Coffee — site meeting Gleeson', '2025-10-08', 0, 0, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -180.00, 'Electric Ireland — workshop Q1', '2025-03-15', 24.32, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -165.00, 'Electric Ireland — workshop Q2', '2025-06-15', 22.29, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -145.00, 'Electric Ireland — workshop Q3', '2025-09-15', 19.60, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -195.00, 'Electric Ireland — workshop Q4', '2025-12-15', 26.35, 13.5, true),
  (v_user_id, v_account_id, v_cat_sundry, 'expense', -89.00, 'Tesco — miscellaneous', '2025-04-18', 0, 0, true),
  (v_user_id, v_account_id, v_cat_sundry, 'expense', -125.00, 'Amazon — unknown purchase', '2025-07-22', 0, 0, true),
  (v_user_id, v_account_id, NULL, 'expense', -340.00, 'Transfer to personal account', '2025-08-14', 0, 0, true),
  (v_user_id, v_account_id, NULL, 'expense', -78.50, 'Penneys — clothing', '2025-09-18', 0, 0, true),
  (v_user_id, v_account_id, NULL, 'expense', -156.00, 'SuperValu — groceries', '2025-11-02', 0, 0, true);

  RAISE NOTICE 'Oakmont categories + transactions seeded successfully';
END $$;
