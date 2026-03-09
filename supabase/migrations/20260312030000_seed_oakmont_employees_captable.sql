-- ============================================================================
-- OAKMONT CARPENTRY & JOINERY LTD — Employees, Payroll & Cap Table Seed
-- jamie@oakmont.ie
--
-- Safe to re-run: uses ON CONFLICT / NOT EXISTS guards
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_jamie_emp_id UUID;
  v_mark_emp_id UUID;
  v_share_class_id UUID;
  v_jamie_sh_id UUID;
  v_sarah_sh_id UUID;
  v_pr_id UUID;
BEGIN
  -- ── Find jamie@oakmont.ie ──
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jamie@oakmont.ie';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'jamie@oakmont.ie not found — skipping employee/cap table seed';
    RETURN;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 1. EMPLOYEES
  -- ══════════════════════════════════════════════════════════════

  -- Jamie Fitzgerald (Director/Owner)
  INSERT INTO public.employees (
    user_id, created_by, ppsn, first_name, last_name, email,
    employment_start_date, is_director, pay_frequency, annual_salary,
    tax_credits_yearly, standard_rate_cut_off_yearly,
    usc_status, prsi_class,
    pension_employee_pct, pension_employer_pct,
    notes, is_active
  ) VALUES (
    v_user_id, v_user_id, '1234567TW', 'Jamie', 'Fitzgerald', 'jamie@oakmont.ie',
    '2020-03-01', true, 'monthly', 48000.00,
    3550.00, 49000.00,
    'ordinary', 'S',
    10.00, 0.00,
    'Director/Owner — PRSI Class S (self-employed director)', true
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_jamie_emp_id FROM public.employees
    WHERE user_id = v_user_id AND ppsn = '1234567TW' LIMIT 1;

  -- Mark Doyle (Apprentice Carpenter — employee)
  INSERT INTO public.employees (
    user_id, created_by, ppsn, first_name, last_name, email,
    employment_start_date, is_director, pay_frequency, annual_salary,
    tax_credits_yearly, standard_rate_cut_off_yearly,
    usc_status, prsi_class,
    pension_employee_pct, pension_employer_pct,
    notes, is_active
  ) VALUES (
    v_user_id, v_user_id, '9876543AB', 'Mark', 'Doyle', 'mark.doyle@gmail.com',
    '2024-09-02', false, 'monthly', 26000.00,
    3550.00, 44000.00,
    'ordinary', 'A1',
    1.50, 1.50,
    '3rd year apprentice carpenter — SOLAS registered. Auto-enrolment eligible from Sep 2025.', true
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_mark_emp_id FROM public.employees
    WHERE user_id = v_user_id AND ppsn = '9876543AB' LIMIT 1;

  -- ══════════════════════════════════════════════════════════════
  -- 2. PAYROLL RUNS (2025 — monthly, 12 periods)
  -- ══════════════════════════════════════════════════════════════

  -- Clear existing 2025 payroll runs for clean seed
  DELETE FROM public.payroll_runs WHERE user_id = v_user_id AND tax_year = 2025;

  -- Insert 12 monthly payroll runs (approved status — looks realistic in demo)
  INSERT INTO public.payroll_runs (user_id, created_by, tax_year, pay_period, pay_frequency, pay_date, status) VALUES
  (v_user_id, v_user_id, 2025, 1, 'monthly', '2025-01-28', 'approved'),
  (v_user_id, v_user_id, 2025, 2, 'monthly', '2025-02-28', 'approved'),
  (v_user_id, v_user_id, 2025, 3, 'monthly', '2025-03-28', 'approved'),
  (v_user_id, v_user_id, 2025, 4, 'monthly', '2025-04-28', 'approved'),
  (v_user_id, v_user_id, 2025, 5, 'monthly', '2025-05-28', 'approved'),
  (v_user_id, v_user_id, 2025, 6, 'monthly', '2025-06-28', 'approved'),
  (v_user_id, v_user_id, 2025, 7, 'monthly', '2025-07-28', 'approved'),
  (v_user_id, v_user_id, 2025, 8, 'monthly', '2025-08-28', 'approved'),
  (v_user_id, v_user_id, 2025, 9, 'monthly', '2025-09-28', 'approved'),
  (v_user_id, v_user_id, 2025, 10, 'monthly', '2025-10-28', 'approved'),
  (v_user_id, v_user_id, 2025, 11, 'monthly', '2025-11-28', 'approved'),
  (v_user_id, v_user_id, 2025, 12, 'monthly', '2025-12-28', 'draft');

  -- ══════════════════════════════════════════════════════════════
  -- 3. PAYROLL LINES — Jamie (Director, €4k/month gross)
  -- ══════════════════════════════════════════════════════════════
  -- Jamie: €4,000 gross/month, PRSI Class S (4%), no employer PRSI,
  -- PAYE ~€455/mo, USC ~€145/mo, pension 10% = €400/mo

  IF v_jamie_emp_id IS NOT NULL THEN
    INSERT INTO public.payroll_lines (
      payroll_run_id, employee_id,
      gross_pay, paye_tax, usc, employee_prsi, pension_employee,
      employer_prsi, pension_employer,
      total_deductions, net_pay, total_employer_cost,
      cumulative_gross, cumulative_tax, cumulative_usc, cumulative_prsi
    )
    SELECT
      pr.id, v_jamie_emp_id,
      4000.00,    -- gross
      455.00,     -- PAYE (approx cumulative basis)
      145.00,     -- USC
      160.00,     -- PRSI Class S @ 4%
      400.00,     -- Pension 10%
      0.00,       -- No employer PRSI (Class S)
      0.00,       -- No employer pension
      1160.00,    -- total deductions
      2840.00,    -- net pay
      4000.00,    -- total employer cost
      4000.00 * pr.pay_period,   -- cumulative gross
      455.00 * pr.pay_period,    -- cumulative tax
      145.00 * pr.pay_period,    -- cumulative USC
      160.00 * pr.pay_period     -- cumulative PRSI
    FROM public.payroll_runs pr
    WHERE pr.user_id = v_user_id AND pr.tax_year = 2025 AND pr.pay_frequency = 'monthly'
    ORDER BY pr.pay_period;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 4. PAYROLL LINES — Mark Doyle (Apprentice, €2,166.67/month)
  -- ══════════════════════════════════════════════════════════════
  -- Mark: €26k/year = €2,166.67/mo, PRSI A1, employer PRSI 11.05%,
  -- PAYE ~€120/mo, USC ~€45/mo, employee PRSI 4%, pension 1.5%

  IF v_mark_emp_id IS NOT NULL THEN
    INSERT INTO public.payroll_lines (
      payroll_run_id, employee_id,
      gross_pay, paye_tax, usc, employee_prsi, pension_employee,
      employer_prsi, pension_employer,
      total_deductions, net_pay, total_employer_cost,
      cumulative_gross, cumulative_tax, cumulative_usc, cumulative_prsi
    )
    SELECT
      pr.id, v_mark_emp_id,
      2166.67,    -- gross
      120.00,     -- PAYE
      45.00,      -- USC
      86.67,      -- PRSI A1 @ 4%
      32.50,      -- Pension 1.5%
      239.42,     -- Employer PRSI @ 11.05%
      32.50,      -- Employer pension 1.5%
      284.17,     -- total deductions (PAYE + USC + PRSI + pension)
      1882.50,    -- net pay
      2438.59,    -- total employer cost (gross + employer PRSI + employer pension)
      2166.67 * pr.pay_period,
      120.00 * pr.pay_period,
      45.00 * pr.pay_period,
      86.67 * pr.pay_period
    FROM public.payroll_runs pr
    WHERE pr.user_id = v_user_id AND pr.tax_year = 2025 AND pr.pay_frequency = 'monthly'
    ORDER BY pr.pay_period;
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 5. DIVIDEND DECLARATIONS (2025)
  -- ══════════════════════════════════════════════════════════════

  DELETE FROM public.dividend_declarations WHERE user_id = v_user_id;

  IF v_jamie_emp_id IS NOT NULL THEN
    INSERT INTO public.dividend_declarations (
      user_id, created_by, employee_id, recipient_name, recipient_ppsn,
      declaration_date, payment_date, gross_amount, dwt_rate, dwt_amount, net_amount,
      dwt_due_date, dwt_paid, board_resolution_ref, notes, status
    ) VALUES (
      v_user_id, v_user_id, v_jamie_emp_id, 'Jamie Fitzgerald', '1234567TW',
      '2025-06-30', '2025-07-14', 5000.00, 25, 1250.00, 3750.00,
      '2025-08-14', true, 'BR-2025-001',
      'Interim dividend — H1 2025 profits. DWT filed and paid to Revenue.',
      'dwt_filed'
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 6. CAP TABLE — SHARE CLASSES
  -- ══════════════════════════════════════════════════════════════

  INSERT INTO public.share_classes (user_id, class_name, nominal_value, voting_rights, dividend_rights, currency, total_authorised, notes)
  VALUES (v_user_id, 'Ordinary', 1.00, true, true, 'EUR', 1000, 'Standard ordinary shares — one vote per share, full dividend rights')
  ON CONFLICT (user_id, class_name) DO UPDATE SET
    total_authorised = EXCLUDED.total_authorised,
    notes = EXCLUDED.notes;

  SELECT id INTO v_share_class_id FROM public.share_classes
    WHERE user_id = v_user_id AND class_name = 'Ordinary' LIMIT 1;

  -- ══════════════════════════════════════════════════════════════
  -- 7. CAP TABLE — SHAREHOLDERS
  -- ══════════════════════════════════════════════════════════════

  -- Jamie Fitzgerald (Director/Majority owner)
  INSERT INTO public.shareholders (
    user_id, created_by, shareholder_name, shareholder_type, ppsn,
    address, email, phone, is_director, employee_id, notes, is_active
  ) VALUES (
    v_user_id, v_user_id, 'Jamie Fitzgerald', 'individual', '1234567TW',
    '14 Hazelwood Drive, Bray, Co. Wicklow', 'jamie@oakmont.ie', '087 123 4567',
    true, v_jamie_emp_id, 'Founder & Managing Director', true
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_jamie_sh_id FROM public.shareholders
    WHERE user_id = v_user_id AND shareholder_name = 'Jamie Fitzgerald' LIMIT 1;

  -- Sarah Fitzgerald (Spouse — minority shareholder)
  INSERT INTO public.shareholders (
    user_id, created_by, shareholder_name, shareholder_type, ppsn,
    address, email, is_director, notes, is_active
  ) VALUES (
    v_user_id, v_user_id, 'Sarah Fitzgerald', 'individual', '7654321TW',
    '14 Hazelwood Drive, Bray, Co. Wicklow', 'sarah.fitzgerald@gmail.com',
    false, 'Spouse — minority shareholder. Employed at St. James''s Hospital (€38k PAYE).', true
  )
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_sarah_sh_id FROM public.shareholders
    WHERE user_id = v_user_id AND shareholder_name = 'Sarah Fitzgerald' LIMIT 1;

  -- ══════════════════════════════════════════════════════════════
  -- 8. CAP TABLE — SHARE ALLOCATIONS
  -- ══════════════════════════════════════════════════════════════

  -- Clear existing allocations for clean seed
  DELETE FROM public.share_allocations WHERE user_id = v_user_id;

  IF v_share_class_id IS NOT NULL AND v_jamie_sh_id IS NOT NULL THEN
    -- Jamie: 80 shares at incorporation (80%)
    INSERT INTO public.share_allocations (
      user_id, shareholder_id, share_class_id, num_shares,
      date_acquired, acquisition_type, price_per_share, total_consideration,
      certificate_number, notes
    ) VALUES (
      v_user_id, v_jamie_sh_id, v_share_class_id, 80,
      '2020-03-01', 'incorporation', 1.00, 80.00,
      'CERT-001', 'Incorporation allotment — 80% founding stake'
    );
  END IF;

  IF v_share_class_id IS NOT NULL AND v_sarah_sh_id IS NOT NULL THEN
    -- Sarah: 20 shares at incorporation (20%)
    INSERT INTO public.share_allocations (
      user_id, shareholder_id, share_class_id, num_shares,
      date_acquired, acquisition_type, price_per_share, total_consideration,
      certificate_number, notes
    ) VALUES (
      v_user_id, v_sarah_sh_id, v_share_class_id, 20,
      '2020-03-01', 'incorporation', 1.00, 20.00,
      'CERT-002', 'Incorporation allotment — 20% spouse stake'
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════
  -- 9. INSERT POLICIES (allow user to manage own employees)
  -- ══════════════════════════════════════════════════════════════
  -- These are already handled by existing RLS policies

  RAISE NOTICE 'Oakmont employees, payroll, dividends & cap table seeded successfully';
END $$;
