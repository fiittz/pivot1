-- ============================================================================
-- OAKMONT CARPENTRY & JOINERY LTD — Demo Seed Data
-- jamie@oakmont.ie — Carpenter & Joiner LLC
--
-- This seeds realistic data for live demos showcasing:
--   CT1 computation, Form 11, VAT3, RCT, P&L, invoicing
--
-- Safe to re-run: uses ON CONFLICT / upsert patterns
-- Does NOT touch invoices (user said "invoices can stay")
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_account_id UUID;
  -- Category IDs (looked up after seed)
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
  -- Customers
  v_cust_mccarthy UUID;
  v_cust_obrien UUID;
  v_cust_dunne UUID;
  v_cust_gleeson UUID;
  v_cust_murphy UUID;
  v_cust_kinsella UUID;
BEGIN
  -- ── Find jamie@oakmont.ie ──
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jamie@oakmont.ie';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'jamie@oakmont.ie not found — skipping demo seed';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 1. PROFILE
  -- ══════════════════════════════════════════════════════════════
  UPDATE public.profiles SET
    business_name = 'Oakmont Carpentry & Joinery Ltd',
    business_type = 'carpentry_joinery',
    email = 'jamie@oakmont.ie',
    phone = '087 123 4567',
    address = '14 Hazelwood Drive, Bray, Co. Wicklow, A98 X2Y3',
    vat_number = 'IE3456789TH',
    business_description = 'Bespoke carpentry, kitchen fitting, and general joinery services across Dublin and Wicklow. Specialising in residential renovations, custom furniture, and commercial fit-outs.'
  WHERE id = v_user_id;

  -- ══════════════════════════════════════════════════════════════
  -- 2. ONBOARDING SETTINGS
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO public.onboarding_settings (
    user_id, business_name, business_type, industry,
    has_employees, employee_count, invoicing,
    income_streams, expense_types, transaction_sources,
    receipt_upload_method, ocr_required,
    vat_registered, vat_number, vat_basis, vat_frequency,
    vat_rates_used,
    eu_trade_enabled, uses_subcontractors,
    payroll_frequency, payment_terms, year_end,
    onboarding_completed, completed_at
  ) VALUES (
    v_user_id,
    'Oakmont Carpentry & Joinery Ltd',
    'limited_company',
    'carpentry',
    true, 2, true,
    ARRAY['contract_work', 'labour', 'materials_charged'],
    ARRAY['materials', 'subcontractors', 'tools', 'motor', 'insurance'],
    ARRAY['bank_feed', 'manual'],
    'photo', true,
    true, 'IE3456789TH', 'invoice', 'bi_monthly',
    ARRAY['standard_23', 'reduced_13_5', 'zero_rated'],
    false, true,
    'monthly', 'net_30', '2025-12-31',
    true, NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    industry = EXCLUDED.industry,
    has_employees = EXCLUDED.has_employees,
    employee_count = EXCLUDED.employee_count,
    invoicing = EXCLUDED.invoicing,
    income_streams = EXCLUDED.income_streams,
    vat_registered = EXCLUDED.vat_registered,
    vat_number = EXCLUDED.vat_number,
    vat_basis = EXCLUDED.vat_basis,
    vat_frequency = EXCLUDED.vat_frequency,
    vat_rates_used = EXCLUDED.vat_rates_used,
    uses_subcontractors = EXCLUDED.uses_subcontractors,
    onboarding_completed = EXCLUDED.onboarding_completed,
    completed_at = EXCLUDED.completed_at;

  -- ══════════════════════════════════════════════════════════════
  -- 3. DIRECTOR ONBOARDING
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO public.director_onboarding (
    user_id, director_number, director_name,
    pps_number, date_of_birth, marital_status,
    assessment_basis, annual_salary,
    receives_dividends, estimated_dividends,
    onboarding_completed,
    onboarding_data
  ) VALUES (
    v_user_id, 1, 'Jamie Fitzgerald',
    '1234567TW', '1990-06-15', 'married',
    'joint', 48000,
    true, 5000,
    true,
    jsonb_build_object(
      'tax_year_start', '2025-01-01',
      'employment_start_date', '2020-03-01',
      'salary_frequency', 'monthly',
      'home_address', '14 Hazelwood Drive, Bray, Co. Wicklow',
      'home_county', 'Wicklow',
      'workshop_address', 'Unit 3, Bray Business Park, Bray, Co. Wicklow',
      'workshop_county', 'Wicklow',
      'commute_method', 'personal_vehicle',
      'commute_distance_km', 12,
      'vehicle_owned_by_director', true,
      'vehicle_description', '2022 Ford Transit Custom',
      'vehicle_reg', '221-WW-4567',
      'vehicle_purchase_cost', 28500,
      'vehicle_date_acquired', '2022-01-15',
      'vehicle_business_use_pct', 85,
      'has_bik', false,
      'income_sources', jsonb_build_array('self_employed_director'),
      'is_director_owner', true,
      'reliefs', jsonb_build_array('pension_contributions', 'medical_expenses'),
      'has_dependent_children', true,
      'dependent_children_count', 2,
      'home_carer_credit', true,
      'flat_rate_expenses', false,
      'remote_working_relief', false,
      'pays_preliminary_tax', 'yes',
      'foreign_cgt_options', jsonb_build_array('none'),
      'declaration_confirmed', true
    )
  )
  ON CONFLICT (user_id, director_number) DO UPDATE SET
    director_name = EXCLUDED.director_name,
    pps_number = EXCLUDED.pps_number,
    date_of_birth = EXCLUDED.date_of_birth,
    marital_status = EXCLUDED.marital_status,
    assessment_basis = EXCLUDED.assessment_basis,
    annual_salary = EXCLUDED.annual_salary,
    receives_dividends = EXCLUDED.receives_dividends,
    estimated_dividends = EXCLUDED.estimated_dividends,
    onboarding_completed = EXCLUDED.onboarding_completed,
    onboarding_data = EXCLUDED.onboarding_data;

  -- ══════════════════════════════════════════════════════════════
  -- 4. ACCOUNT (Business Current Account)
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
  ELSE
    UPDATE public.accounts SET
      balance = 34562.18,
      iban = 'IE29AIBK93115212345678',
      bic = 'AIBKIE2D'
    WHERE id = v_account_id;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 5. CUSTOMERS
  -- ══════════════════════════════════════════════════════════════

  -- McCarthy Builders (main contractor — RCT source)
  INSERT INTO public.customers (user_id, name, email, phone, address, vat_number)
  VALUES (v_user_id, 'McCarthy Builders Ltd', 'accounts@mccarthybuilders.ie', '01 234 5678',
    '45 Sandyford Industrial Estate, Dublin 18', 'IE9876543AB')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_mccarthy;
  IF v_cust_mccarthy IS NULL THEN
    SELECT id INTO v_cust_mccarthy FROM public.customers WHERE user_id = v_user_id AND name = 'McCarthy Builders Ltd';
  END IF;

  -- O'Brien Residential
  INSERT INTO public.customers (user_id, name, email, phone, address)
  VALUES (v_user_id, 'Seán & Marie O''Brien', 'sean.obrien@gmail.com', '086 555 1234',
    '22 Foxrock Crescent, Dublin 18')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_obrien;
  IF v_cust_obrien IS NULL THEN
    SELECT id INTO v_cust_obrien FROM public.customers WHERE user_id = v_user_id AND name = 'Seán & Marie O''Brien';
  END IF;

  -- Dunne Interiors (commercial fit-out)
  INSERT INTO public.customers (user_id, name, email, phone, address, vat_number)
  VALUES (v_user_id, 'Dunne Interiors Ltd', 'info@dunneinteriors.ie', '01 456 7890',
    'Unit 12, Stillorgan Business Park, Co. Dublin', 'IE6543210KL')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_dunne;
  IF v_cust_dunne IS NULL THEN
    SELECT id INTO v_cust_dunne FROM public.customers WHERE user_id = v_user_id AND name = 'Dunne Interiors Ltd';
  END IF;

  -- Gleeson Property Management
  INSERT INTO public.customers (user_id, name, email, phone, address, vat_number)
  VALUES (v_user_id, 'Gleeson Property Management', 'maintenance@gleesonpm.ie', '01 789 0123',
    '8 Merrion Square, Dublin 2', 'IE1122334MN')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_gleeson;
  IF v_cust_gleeson IS NULL THEN
    SELECT id INTO v_cust_gleeson FROM public.customers WHERE user_id = v_user_id AND name = 'Gleeson Property Management';
  END IF;

  -- Murphy family (kitchen renovation)
  INSERT INTO public.customers (user_id, name, email, phone, address)
  VALUES (v_user_id, 'Patrick & Aoife Murphy', 'aoife.murphy@hotmail.com', '085 333 4567',
    '7 Woodlands Park, Greystones, Co. Wicklow')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_murphy;
  IF v_cust_murphy IS NULL THEN
    SELECT id INTO v_cust_murphy FROM public.customers WHERE user_id = v_user_id AND name = 'Patrick & Aoife Murphy';
  END IF;

  -- Kinsella (bespoke furniture)
  INSERT INTO public.customers (user_id, name, email, phone, address)
  VALUES (v_user_id, 'Rachel Kinsella', 'rachel.kinsella@outlook.com', '087 888 9012',
    '15 Killiney Hill Road, Killiney, Co. Dublin')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_cust_kinsella;
  IF v_cust_kinsella IS NULL THEN
    SELECT id INTO v_cust_kinsella FROM public.customers WHERE user_id = v_user_id AND name = 'Rachel Kinsella';
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 6. LOOK UP CATEGORY IDs
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

  -- If categories not seeded yet, skip transactions
  IF v_cat_contract_work IS NULL THEN
    RAISE NOTICE 'Categories not seeded for jamie@oakmont.ie — run onboarding first, then re-run this migration';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 7. CLEAR ALL 2025 TRANSACTIONS (full overwrite for demo)
  -- ══════════════════════════════════════════════════════════════
  DELETE FROM public.transactions
    WHERE user_id = v_user_id
      AND transaction_date >= '2025-01-01'
      AND transaction_date <= '2025-12-31';

  -- ══════════════════════════════════════════════════════════════
  -- 8. INCOME TRANSACTIONS (2025 tax year)
  -- ══════════════════════════════════════════════════════════════

  -- Q1: Kitchen renovation for O'Briens
  INSERT INTO public.transactions (user_id, account_id, category_id, type, amount, description, transaction_date, vat_amount, vat_rate, is_reconciled) VALUES
  (v_user_id, v_account_id, v_cat_labour, 'income', 4200.00, 'O''Brien kitchen — labour week 1-2', '2025-01-20', 554.63, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 6850.00, 'O''Brien kitchen — cabinets & worktops', '2025-01-25', 1281.72, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 3800.00, 'O''Brien kitchen — installation & finishing', '2025-02-10', 501.76, 13.5, true),

  -- Q1: McCarthy Builders — apartment block joinery (RCT contract)
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 12500.00, 'McCarthy Builders — Sandyford apt joinery phase 1', '2025-02-28', 0, 0, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 8750.00, 'McCarthy Builders — Sandyford apt joinery phase 2', '2025-03-25', 0, 0, true),

  -- Q2: Dunne Interiors fit-out
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 9200.00, 'Dunne Interiors — office reception panelling', '2025-04-15', 1720.16, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 5600.00, 'Dunne Interiors — boardroom fit-out labour', '2025-05-08', 739.56, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 3400.00, 'Dunne Interiors — timber & hardware charged', '2025-05-12', 635.77, 23, true),

  -- Q2: Gleeson PM — maintenance contract
  (v_user_id, v_account_id, v_cat_labour, 'income', 1850.00, 'Gleeson PM — door replacements Merrion Sq', '2025-04-22', 244.27, 13.5, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 2200.00, 'Gleeson PM — sash window repairs Ranelagh', '2025-06-05', 290.48, 13.5, true),

  -- Q3: Murphy kitchen renovation
  (v_user_id, v_account_id, v_cat_labour, 'income', 5500.00, 'Murphy kitchen — demolition & prep', '2025-07-07', 726.37, 13.5, true),
  (v_user_id, v_account_id, v_cat_materials_charged, 'income', 8200.00, 'Murphy kitchen — island unit & Silestone worktop', '2025-07-18', 1533.17, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 4800.00, 'Murphy kitchen — installation & tiling prep', '2025-08-05', 633.70, 13.5, true),

  -- Q3: Kinsella bespoke furniture
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 3200.00, 'Kinsella — bespoke walnut bookcase', '2025-08-20', 598.37, 23, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 2800.00, 'Kinsella — built-in wardrobe system', '2025-09-10', 523.58, 23, true),

  -- Q3: McCarthy Builders phase 3
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 15000.00, 'McCarthy Builders — Sandyford apt joinery phase 3', '2025-09-30', 0, 0, true),

  -- Q4: Gleeson maintenance
  (v_user_id, v_account_id, v_cat_labour, 'income', 1600.00, 'Gleeson PM — fire door upgrades Ballsbridge', '2025-10-14', 211.24, 13.5, true),

  -- Q4: Year-end rush
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 7500.00, 'Dunne Interiors — retail shop fit-out Grafton St', '2025-11-08', 1402.44, 23, true),
  (v_user_id, v_account_id, v_cat_labour, 'income', 3200.00, 'O''Brien — utility room extension joinery', '2025-11-25', 422.47, 13.5, true),
  (v_user_id, v_account_id, v_cat_contract_work, 'income', 4500.00, 'Gleeson PM — common area refurbishment', '2025-12-10', 841.46, 23, true);

  -- ══════════════════════════════════════════════════════════════
  -- 9. EXPENSE TRANSACTIONS (2025 tax year)
  -- ══════════════════════════════════════════════════════════════

  INSERT INTO public.transactions (user_id, account_id, category_id, type, amount, description, transaction_date, vat_amount, vat_rate, is_reconciled) VALUES
  -- Materials & Supplies (monthly purchases)
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

  -- Subcontractor costs
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -3500.00, 'Dave Byrne Electrics — kitchen wiring O''Brien', '2025-02-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -2800.00, 'Liam Nolan Plumbing — kitchen plumbing O''Brien', '2025-02-18', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -4200.00, 'Dave Byrne Electrics — Dunne office wiring', '2025-05-20', 0, 0, true),
  (v_user_id, v_account_id, v_cat_subcontractor, 'expense', -2500.00, 'Liam Nolan Plumbing — Murphy kitchen', '2025-07-25', 0, 0, true),

  -- Tools & Equipment (some capital items)
  (v_user_id, v_account_id, v_cat_tools, 'expense', -189.00, 'Screwfix — drill bits & blades', '2025-01-30', 35.35, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -2450.00, 'DeWalt — DWS780 mitre saw', '2025-03-15', 458.13, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -345.00, 'Festool — sanding pads & accessories', '2025-06-20', 64.51, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -1650.00, 'Makita — track saw system', '2025-09-12', 308.54, 23, true),
  (v_user_id, v_account_id, v_cat_tools, 'expense', -89.00, 'Stanley — measuring & marking set', '2025-11-15', 16.64, 23, true),

  -- Motor & Travel
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

  -- Insurance
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -2400.00, 'Allianz — public liability insurance', '2025-01-05', 0, 0, true),
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -1800.00, 'AIG — employer liability insurance', '2025-01-05', 0, 0, true),
  (v_user_id, v_account_id, v_cat_insurance, 'expense', -1350.00, 'AXA — van insurance renewal', '2025-02-01', 0, 0, true),

  -- Professional Fees
  (v_user_id, v_account_id, v_cat_prof_fees, 'expense', -1800.00, 'Balnce — annual accounting fee', '2025-06-15', 336.59, 23, true),
  (v_user_id, v_account_id, v_cat_prof_fees, 'expense', -350.00, 'CRO — annual return filing', '2025-09-28', 0, 0, true),

  -- Phone & Comms
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

  -- Bank Charges
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

  -- Director's Remuneration (monthly salary draws)
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

  -- Workshop rent
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q1', '2025-01-02', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q2', '2025-04-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q3', '2025-07-01', 0, 0, true),
  (v_user_id, v_account_id, v_cat_rent, 'expense', -650.00, 'Workshop rent — Q4', '2025-10-01', 0, 0, true),

  -- Training
  (v_user_id, v_account_id, v_cat_training, 'expense', -450.00, 'SOLAS — Safe Pass renewal', '2025-02-20', 0, 0, true),
  (v_user_id, v_account_id, v_cat_training, 'expense', -320.00, 'City & Guilds — kitchen design CPD', '2025-06-10', 0, 0, true),

  -- Advertising
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Jan', '2025-01-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Feb', '2025-02-15', 0, 0, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -350.00, 'GoldenPages.ie — annual listing', '2025-03-01', 65.45, 23, true),
  (v_user_id, v_account_id, v_cat_advertising, 'expense', -150.00, 'Google Ads — Oct', '2025-10-15', 0, 0, true),

  -- Protective clothing
  (v_user_id, v_account_id, v_cat_protective, 'expense', -285.00, 'Safety Direct — boots, goggles, hi-vis', '2025-03-05', 53.29, 23, true),

  -- Meals (partially disallowed — entertainment for demo)
  (v_user_id, v_account_id, v_cat_meals, 'expense', -65.00, 'Avoca — client lunch O''Brien', '2025-02-12', 0, 0, true),
  (v_user_id, v_account_id, v_cat_meals, 'expense', -120.00, 'Chapter One — dinner with McCarthy', '2025-05-22', 0, 0, true),
  (v_user_id, v_account_id, v_cat_meals, 'expense', -45.00, 'Costa Coffee — site meeting Gleeson', '2025-10-08', 0, 0, true),

  -- Light, heat & power (workshop)
  (v_user_id, v_account_id, v_cat_light, 'expense', -180.00, 'Electric Ireland — workshop Q1', '2025-03-15', 24.32, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -165.00, 'Electric Ireland — workshop Q2', '2025-06-15', 22.29, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -145.00, 'Electric Ireland — workshop Q3', '2025-09-15', 19.60, 13.5, true),
  (v_user_id, v_account_id, v_cat_light, 'expense', -195.00, 'Electric Ireland — workshop Q4', '2025-12-15', 26.35, 13.5, true),

  -- Sundry (some uncategorised for add-back demo)
  (v_user_id, v_account_id, v_cat_sundry, 'expense', -89.00, 'Tesco — miscellaneous', '2025-04-18', 0, 0, true),
  (v_user_id, v_account_id, v_cat_sundry, 'expense', -125.00, 'Amazon — unknown purchase', '2025-07-22', 0, 0, true),

  -- Uncategorised expenses (will trigger add-backs in P&L)
  (v_user_id, v_account_id, NULL, 'expense', -340.00, 'Transfer to personal account', '2025-08-14', 0, 0, true),
  (v_user_id, v_account_id, NULL, 'expense', -78.50, 'Penneys — clothing', '2025-09-18', 0, 0, true),
  (v_user_id, v_account_id, NULL, 'expense', -156.00, 'SuperValu — groceries', '2025-11-02', 0, 0, true);

  -- ══════════════════════════════════════════════════════════════
  -- 10. SUBCONTRACTORS (for RCT)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO public.subcontractors (user_id, name, email, phone, ppsn_or_tax_ref, verified_with_revenue, revenue_rate)
  VALUES
    (v_user_id, 'Dave Byrne Electrics', 'dave@byrneelectrics.ie', '086 111 2233', '7654321AB', true, 0),
    (v_user_id, 'Liam Nolan Plumbing', 'liam@nolanplumbing.ie', '087 444 5566', '8765432CD', true, 20)
  ON CONFLICT DO NOTHING;

  -- ══════════════════════════════════════════════════════════════
  -- 11. RCT CONTRACTS (with McCarthy Builders as principal)
  -- ══════════════════════════════════════════════════════════════
  INSERT INTO public.rct_contracts (
    user_id, principal_name, principal_tax_ref,
    contract_ref, site_address,
    contract_start, contract_end, estimated_value, status,
    notified_at
  )
  SELECT
    v_user_id, 'McCarthy Builders Ltd', 'IE9876543AB',
    'RCT-2025-001', 'Sandyford apartment block — electrical fit-out',
    '2025-01-15', '2025-12-31', 45000.00, 'active',
    '2025-01-20T00:00:00Z'::timestamptz
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rct_contracts WHERE user_id = v_user_id AND contract_ref = 'RCT-2025-001'
  );

  RAISE NOTICE 'Oakmont demo data seeded successfully for jamie@oakmont.ie';
END $$;
