-- Migration: Seed CRO demo data for Oakmont Carpentry (jamie@oakmont.ie)
-- Inserts cro_companies, cro_filings, and cro_annual_accounts demo data

DO $$
DECLARE
  v_user_id UUID;
  v_cro_id UUID;
  v_filing_b1_2021 UUID;
  v_filing_b1_2022 UUID;
  v_filing_b10_2022 UUID;
  v_filing_b1_2023 UUID;
  v_filing_b2_2023 UUID;
  v_filing_b1_2024 UUID;
  v_filing_b1_2025 UUID;
BEGIN
  -- Look up jamie@oakmont.ie user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'jamie@oakmont.ie';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User jamie@oakmont.ie not found, skipping CRO seed';
    RETURN;
  END IF;

  -- =========================================================================
  -- 1. Create/update cro_companies entry
  -- =========================================================================

  INSERT INTO public.cro_companies (
    user_id,
    company_num,
    company_name,
    company_status_desc,
    company_status_code,
    comp_type_desc,
    company_type_code,
    company_reg_date,
    address_line1,
    address_line2,
    address_line3,
    address_line4,
    eircode,
    last_ar_date,
    next_ar_date,
    last_acc_date,
    auto_sync_enabled
  ) VALUES (
    v_user_id,
    '654321',
    'Oakmont Carpentry & Joinery Ltd',
    'Normal',
    0,
    'Private Company Limited by Shares',
    1,
    '2020-03-15',
    '14 Hazelwood Drive',
    'Bray',
    'Co. Wicklow',
    NULL,
    'A98 X2Y3',
    '2025-04-12',
    '2026-04-12',
    '2024-12-31',
    true
  )
  ON CONFLICT (company_num) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    company_name = EXCLUDED.company_name,
    company_status_desc = EXCLUDED.company_status_desc,
    company_status_code = EXCLUDED.company_status_code,
    comp_type_desc = EXCLUDED.comp_type_desc,
    company_type_code = EXCLUDED.company_type_code,
    company_reg_date = EXCLUDED.company_reg_date,
    address_line1 = EXCLUDED.address_line1,
    address_line2 = EXCLUDED.address_line2,
    address_line3 = EXCLUDED.address_line3,
    address_line4 = EXCLUDED.address_line4,
    eircode = EXCLUDED.eircode,
    last_ar_date = EXCLUDED.last_ar_date,
    next_ar_date = EXCLUDED.next_ar_date,
    last_acc_date = EXCLUDED.last_acc_date,
    auto_sync_enabled = EXCLUDED.auto_sync_enabled,
    updated_at = now()
  RETURNING id INTO v_cro_id;

  -- =========================================================================
  -- 2. Link to accountant_clients
  -- =========================================================================

  UPDATE public.accountant_clients SET
    cro_number = '654321',
    cro_company_id = v_cro_id
  WHERE client_user_id = v_user_id;

  -- =========================================================================
  -- 3. Seed cro_filings (clean re-insert)
  -- =========================================================================

  DELETE FROM public.cro_filings WHERE cro_company_id = v_cro_id;

  -- B1 Annual Return 2021
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date, acc_year_to_date
  ) VALUES (
    v_cro_id, 'B1 - Annual Return', 'Annual Return', 'Registered',
    '2021-06-10', '2021-04-12', '2020-12-31'
  ) RETURNING id INTO v_filing_b1_2021;

  -- B1 Annual Return 2022
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date, acc_year_to_date
  ) VALUES (
    v_cro_id, 'B1 - Annual Return', 'Annual Return', 'Registered',
    '2022-06-08', '2022-04-12', '2021-12-31'
  ) RETURNING id INTO v_filing_b1_2022;

  -- B10 Change of Registered Office 2022
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date
  ) VALUES (
    v_cro_id, 'B10 - Change of Registered Office', 'Change of Registered Office', 'Registered',
    '2022-09-15', '2022-09-15'
  ) RETURNING id INTO v_filing_b10_2022;

  -- B1 Annual Return 2023
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date, acc_year_to_date
  ) VALUES (
    v_cro_id, 'B1 - Annual Return', 'Annual Return', 'Registered',
    '2023-06-12', '2023-04-12', '2022-12-31'
  ) RETURNING id INTO v_filing_b1_2023;

  -- B2 Change of Directors 2023
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date
  ) VALUES (
    v_cro_id, 'B2 - Change of Directors/Secretary', 'Change of Directors/Secretary', 'Registered',
    '2023-02-20', '2023-02-20'
  ) RETURNING id INTO v_filing_b2_2023;

  -- B1 Annual Return 2024
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date, acc_year_to_date
  ) VALUES (
    v_cro_id, 'B1 - Annual Return', 'Annual Return', 'Registered',
    '2024-06-05', '2024-04-12', '2023-12-31'
  ) RETURNING id INTO v_filing_b1_2024;

  -- B1 Annual Return 2025
  INSERT INTO public.cro_filings (
    cro_company_id, sub_type_desc, doc_type_desc, sub_status_desc,
    sub_received_date, sub_effective_date, acc_year_to_date
  ) VALUES (
    v_cro_id, 'B1 - Annual Return', 'Annual Return', 'Registered',
    '2025-06-09', '2025-04-12', '2024-12-31'
  ) RETURNING id INTO v_filing_b1_2025;

  -- =========================================================================
  -- 4. Seed cro_annual_accounts (clean re-insert)
  -- =========================================================================

  DELETE FROM public.cro_annual_accounts WHERE cro_company_id = v_cro_id;

  -- ---------------------------------------------------------------------------
  -- 2022 (year end 2022-12-31)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.cro_annual_accounts (
    cro_company_id, cro_filing_id, financial_year_end, period_start, data_source,
    fixed_assets_tangible,
    current_assets_debtors, current_assets_cash,
    creditors_within_one_year,
    net_assets,
    share_capital, retained_profits,
    turnover, cost_of_sales, gross_profit,
    operating_expenses, operating_profit,
    profit_before_tax, taxation, profit_after_tax,
    shareholders_funds,
    notes
  ) VALUES (
    v_cro_id, v_filing_b1_2023, '2022-12-31', '2022-01-01', 'accountant_import',
    8500.00,
    2800.00, 12450.00,
    3200.00,
    20550.00,
    100.00, 20450.00,
    78000.00, 42000.00, 36000.00,
    21500.00, 14500.00,
    14500.00, 1813.00, 12687.00,
    20550.00,
    $notes${
  "accounting_policies": {
    "basis_of_preparation": "These financial statements have been prepared in accordance with FRS 102 Section 1A (Small Entities) and the Companies Act 2014.",
    "revenue_recognition": "Revenue is recognised when services are rendered or goods are delivered.",
    "depreciation": "Motor vehicles: 12.5% straight line. Tools & equipment: 12.5% straight line.",
    "going_concern": "The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future."
  },
  "directors_report": {
    "principal_activities": "Bespoke carpentry, kitchen fitting, and general joinery services.",
    "review_of_business": "The company had a satisfactory first full year of trading with turnover of EUR78,000.",
    "future_developments": "The company plans to expand into commercial fit-out work in 2023.",
    "dividends": "No dividends were declared during the year.",
    "post_balance_sheet_events": "No significant events have occurred since the year end."
  },
  "directors": [{"name": "Jamie Fitzgerald", "appointed_date": "2020-03-15"}],
  "secretary": {"name": "Jamie Fitzgerald"},
  "auditor_name": "Audit exempt under Section 352 Companies Act 2014",
  "audit_opinion": "exempt",
  "employees": {"avg_number": 1, "staff_costs": 36000},
  "director_remuneration": 36000,
  "related_party_transactions": "The director is remunerated as disclosed. No other related party transactions.",
  "contingent_liabilities": "None.",
  "capital_commitments": "None.",
  "going_concern": "No material uncertainties.",
  "loans_to_directors": 0,
  "custom_notes": []
}$notes$::jsonb
  );

  -- ---------------------------------------------------------------------------
  -- 2023 (year end 2023-12-31)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.cro_annual_accounts (
    cro_company_id, cro_filing_id, financial_year_end, period_start, data_source,
    fixed_assets_tangible,
    current_assets_debtors, current_assets_cash,
    creditors_within_one_year,
    net_assets,
    share_capital, retained_profits,
    turnover, cost_of_sales, gross_profit,
    operating_expenses, operating_profit,
    profit_before_tax, taxation, profit_after_tax,
    dividends_paid,
    shareholders_funds,
    notes
  ) VALUES (
    v_cro_id, v_filing_b1_2024, '2023-12-31', '2023-01-01', 'accountant_import',
    32400.00,
    3600.00, 22800.00,
    4100.00,
    54700.00,
    100.00, 54600.00,
    95000.00, 48500.00, 46500.00,
    28200.00, 18300.00,
    18300.00, 2288.00, 16012.00,
    0.00,
    54700.00,
    $notes${
  "accounting_policies": {
    "basis_of_preparation": "These financial statements have been prepared in accordance with FRS 102 Section 1A (Small Entities) and the Companies Act 2014.",
    "revenue_recognition": "Revenue is recognised when services are rendered or goods are delivered.",
    "depreciation": "Motor vehicles: 12.5% straight line. Tools & equipment: 12.5% straight line.",
    "going_concern": "The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future."
  },
  "directors_report": {
    "principal_activities": "Bespoke carpentry, kitchen fitting, and general joinery services.",
    "review_of_business": "The company continued to grow with turnover reaching EUR95,000. The company secured its first commercial fit-out contracts during the year.",
    "future_developments": "The company plans to hire an apprentice in 2024 to support growing demand.",
    "dividends": "No dividends were declared during the year.",
    "post_balance_sheet_events": "No significant events have occurred since the year end."
  },
  "directors": [{"name": "Jamie Fitzgerald", "appointed_date": "2020-03-15"}],
  "secretary": {"name": "Sarah Fitzgerald", "appointed_date": "2023-02-20"},
  "auditor_name": "Audit exempt under Section 352 Companies Act 2014",
  "audit_opinion": "exempt",
  "employees": {"avg_number": 1, "staff_costs": 42000},
  "director_remuneration": 42000,
  "related_party_transactions": "The director is remunerated as disclosed. No other related party transactions.",
  "contingent_liabilities": "None.",
  "capital_commitments": "None.",
  "going_concern": "No material uncertainties.",
  "loans_to_directors": 0,
  "tangible_fixed_assets_note": "A Ford Transit Custom van was purchased during the year for EUR28,500. Tools and equipment additions of EUR3,200.",
  "custom_notes": []
}$notes$::jsonb
  );

  -- ---------------------------------------------------------------------------
  -- 2024 (year end 2024-12-31)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.cro_annual_accounts (
    cro_company_id, cro_filing_id, financial_year_end, period_start, data_source,
    fixed_assets_tangible,
    current_assets_debtors, current_assets_cash,
    creditors_within_one_year,
    net_assets,
    share_capital, retained_profits,
    turnover, cost_of_sales, gross_profit,
    operating_expenses, operating_profit,
    profit_before_tax, taxation, profit_after_tax,
    dividends_paid, retained_profit_for_year,
    shareholders_funds,
    notes
  ) VALUES (
    v_cro_id, v_filing_b1_2025, '2024-12-31', '2024-01-01', 'accountant_import',
    29900.00,
    4500.00, 34562.00,
    5050.00,
    63912.00,
    100.00, 63812.00,
    108650.00, 55200.00, 53450.00,
    35800.00, 17650.00,
    17650.00, 2206.00, 15444.00,
    5000.00, 10444.00,
    63912.00,
    $notes${
  "accounting_policies": {
    "basis_of_preparation": "These financial statements have been prepared in accordance with FRS 102 Section 1A (Small Entities) and the Companies Act 2014.",
    "revenue_recognition": "Revenue is recognised when services are rendered or goods are delivered.",
    "depreciation": "Motor vehicles: 12.5% straight line. Tools & equipment: 12.5% straight line.",
    "going_concern": "The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future."
  },
  "directors_report": {
    "principal_activities": "Bespoke carpentry, kitchen fitting, and general joinery services.",
    "review_of_business": "The company had another strong year with turnover reaching EUR108,650. An apprentice carpenter (Mark Doyle) was hired in September to support the growing volume of work.",
    "future_developments": "The company plans to expand into bespoke furniture design and manufacture.",
    "dividends": "An interim dividend of EUR5,000 was declared and paid during the year.",
    "post_balance_sheet_events": "No significant events have occurred since the year end."
  },
  "directors": [{"name": "Jamie Fitzgerald", "appointed_date": "2020-03-15"}],
  "secretary": {"name": "Sarah Fitzgerald", "appointed_date": "2023-02-20"},
  "auditor_name": "Audit exempt under Section 352 Companies Act 2014",
  "audit_opinion": "exempt",
  "employees": {"avg_number": 2, "staff_costs": 56000},
  "director_remuneration": 48000,
  "related_party_transactions": "The director is remunerated as disclosed. No other related party transactions.",
  "contingent_liabilities": "None.",
  "capital_commitments": "None.",
  "going_concern": "No material uncertainties.",
  "loans_to_directors": 0,
  "tangible_fixed_assets_note": "Depreciation on Ford Transit Custom van and tools. New tool purchases of EUR1,500 during the year.",
  "custom_notes": []
}$notes$::jsonb
  );

END $$;
