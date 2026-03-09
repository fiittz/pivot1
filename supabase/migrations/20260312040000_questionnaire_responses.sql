-- ============================================================================
-- Questionnaire Responses — Supabase-backed storage for CT1 & Form 11
-- Replaces localStorage-only storage so accountants can access client data
-- ============================================================================

CREATE TABLE questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  questionnaire_type TEXT NOT NULL CHECK (questionnaire_type IN ('ct1', 'form11')),
  period_key TEXT NOT NULL,  -- tax year for CT1 (e.g. '2025'), director number for Form11 (e.g. '1')
  response_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, questionnaire_type, period_key)
);

CREATE INDEX idx_questionnaire_responses_user ON questionnaire_responses(user_id);
CREATE INDEX idx_questionnaire_responses_lookup ON questionnaire_responses(user_id, questionnaire_type, period_key);

-- RLS
ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Users can manage their own
CREATE POLICY "Users manage own questionnaire responses"
  ON questionnaire_responses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Accountants can view client questionnaire responses
CREATE POLICY "Accountants view client questionnaire responses"
  ON questionnaire_responses FOR SELECT
  USING (public.is_accountant_for(user_id));

-- ── Seed Oakmont demo questionnaire data ──
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jamie@oakmont.ie';
  IF v_user_id IS NULL THEN RETURN; END IF;

  -- CT1 Questionnaire (2025)
  INSERT INTO questionnaire_responses (user_id, questionnaire_type, period_key, response_data)
  VALUES (
    v_user_id, 'ct1', '2025',
    '{
      "automationNoChanges": true,
      "incomeComplete": true,
      "expensesCorrect": true,
      "vatStatus": "invoice_basis",
      "vatStatusCorrect": true,
      "rctApplicable": true,
      "rctDeductionsCorrect": true,
      "rctTotalDeducted": 7250,
      "rctNotes": "RCT deducted by McCarthy Builders on phases 1-3",
      "capitalTransactionsCorrect": true,
      "hasClosingStock": false,
      "closingStockValue": 0,
      "hasTradeDebtors": true,
      "tradeDebtorsTotal": 4500,
      "hasBadDebts": false,
      "hasTradeCreditorsOutstanding": true,
      "tradeCreditorsTotal": 1850,
      "fixedAssetsLandBuildings": 0,
      "fixedAssetsPlantMachinery": 4100,
      "fixedAssetsMotorVehicles": 28500,
      "fixedAssetsFixturesFittings": 800,
      "currentAssetsStock": 0,
      "currentAssetsDebtors": 4500,
      "currentAssetsCash": 250,
      "currentAssetsBankBalance": 34562,
      "liabilitiesCreditors": 1850,
      "liabilitiesTaxation": 3200,
      "liabilitiesBankLoans": 0,
      "liabilitiesDirectorsLoans": 0,
      "capitalAllowancesPlant": 513,
      "capitalAllowancesMotorVehicles": 3031,
      "addBackDepreciation": 4200,
      "addBackEntertainment": 230,
      "addBackOther": 574.50,
      "addBackNotes": "Depreciation (accounting), client entertainment, uncategorised personal items",
      "isCloseCompany": true,
      "distributedProfitsSufficiently": true,
      "closeCompanySurcharge": 0,
      "lossesForward": 0,
      "preliminaryCTPaid": 3800,
      "preliminaryCTAmount": 3800,
      "preliminaryCTDate": "2025-11-21",
      "claimStartupExemption": false,
      "hasDividendsPaid": true,
      "dividendsPaidAmount": 5000,
      "dwtDeducted": 1250,
      "hasAssetDisposals": false,
      "finalDeclaration": true,
      "prepaymentsAmount": 400,
      "accrualsAmount": 650,
      "openingPrepayments": 0,
      "openingAccruals": 0,
      "accruedIncomeAmount": 0,
      "deferredIncomeAmount": 0
    }'::jsonb
  )
  ON CONFLICT (user_id, questionnaire_type, period_key) DO UPDATE SET
    response_data = EXCLUDED.response_data,
    updated_at = NOW();

  -- Form 11 Questionnaire (Director 1)
  INSERT INTO questionnaire_responses (user_id, questionnaire_type, period_key, response_data)
  VALUES (
    v_user_id, 'form11', '1',
    '{
      "noChanges": true,
      "incomeComplete": true,
      "salaryCorrect": true,
      "salaryAmount": 48000,
      "dividendsReceived": true,
      "dividendsAmount": 5000,
      "bikApplicable": false,
      "bikCorrect": true,
      "bikEstimatedValue": 0,
      "reliefsCorrect": true,
      "medicalExpensesAmount": 1200,
      "pensionContributionsAmount": 4800,
      "rentReliefAmount": 0,
      "charitableDonationsAmount": 500,
      "remoteWorkingDays": 0,
      "spouseHasIncome": true,
      "spouseIncomeType": ["paye"],
      "spouseIncomeAmount": 38000,
      "spouseEmployerName": "St. James''s Hospital",
      "preliminaryTaxPaid": "yes",
      "preliminaryTaxAmount": "8500",
      "preliminaryTaxDate": "2025-11-15",
      "edgeCases": {
        "capitalGains": false,
        "foreignIncome": false,
        "chargeableBenefits": false,
        "none": true
      },
      "rentalIncomeDetails": false,
      "rentalIncomeAmount": 0,
      "rentalExpensesAmount": 0,
      "finalDeclaration": true
    }'::jsonb
  )
  ON CONFLICT (user_id, questionnaire_type, period_key) DO UPDATE SET
    response_data = EXCLUDED.response_data,
    updated_at = NOW();

  RAISE NOTICE 'Questionnaire responses seeded for jamie@oakmont.ie';
END $$;
