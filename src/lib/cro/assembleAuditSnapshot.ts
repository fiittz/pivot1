import { supabase } from "@/integrations/supabase/client";
import { classifyCompanySize, type CompanySizeResult } from "./companySize";

// ---------------------------------------------------------------------------
// Audit Trail Snapshot — full interface
// ---------------------------------------------------------------------------

export interface AuditTrailSnapshot {
  /** When and who created this snapshot */
  snapshot_date: string;
  snapshot_by: string; // user ID
  tax_year: string;

  /** 1. Company Profile at time of filing */
  company_profile: {
    business_name: string;
    business_type: string;
    vat_number: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
  };

  /** 2. Onboarding settings snapshot */
  onboarding: {
    industry: string | null;
    has_employees: boolean;
    employee_count: number | null;
    vat_registered: boolean;
    vat_basis: string | null;
    vat_frequency: string | null;
    vat_rates_used: string[] | null;
    uses_subcontractors: boolean;
    eu_trade_enabled: boolean;
    payroll_frequency: string | null;
    year_end: string | null;
    income_streams: string[] | null;
    expense_types: string[] | null;
  };

  /** 3. Directors at time of filing */
  directors: Array<{
    director_number: number;
    director_name: string;
    pps_number: string;
    date_of_birth: string;
    marital_status: string;
    assessment_basis: string;
    annual_salary: number;
    receives_dividends: boolean;
    estimated_dividends: number;
    onboarding_data: Record<string, unknown>;
  }>;

  /** 4. Questionnaire responses */
  questionnaires: {
    ct1: Record<string, unknown> | null;
    form11: Record<string, Record<string, unknown>>; // keyed by director number
  };

  /** 5. Year-end snapshot (balance sheet + P&L from year_end_snapshots) */
  year_end_snapshot: Record<string, unknown> | null;

  /** 6. Abridged accounts (formatted financial statements) */
  abridged_accounts: {
    balance_sheet: {
      fixed_assets: {
        tangible: number;
        intangible: number;
        investments: number;
        total: number;
      };
      current_assets: {
        stock: number;
        debtors: number;
        cash_at_bank: number;
        other: number;
        total: number;
      };
      creditors_amounts_falling_due_within_one_year: number;
      net_current_assets: number;
      total_assets_less_current_liabilities: number;
      creditors_amounts_falling_due_after_one_year: number;
      provisions_for_liabilities: number;
      net_assets: number;
      capital_and_reserves: {
        called_up_share_capital: number;
        share_premium: number;
        profit_and_loss_account: number;
        other_reserves: number;
        shareholders_funds: number;
      };
    };
    profit_and_loss: {
      turnover: number;
      cost_of_sales: number;
      gross_profit: number;
      distribution_costs: number;
      administrative_expenses: number;
      other_operating_income: number;
      operating_profit: number;
      interest_receivable: number;
      interest_payable: number;
      profit_on_ordinary_activities_before_tax: number;
      tax_on_profit: number;
      profit_for_the_financial_year: number;
      dividends_paid: number;
      retained_profit_for_year: number;
      retained_profit_brought_forward: number;
      retained_profit_carried_forward: number;
    };
    notes_to_accounts: {
      basis_of_preparation: string;
      accounting_convention: string;
      revenue_recognition: string;
      tangible_fixed_assets: string;
      depreciation_rates: Record<string, string>;
      stock_valuation: string;
      taxation: string;
      going_concern: string;
      average_employees: number;
      staff_costs: number;
      directors_remuneration: number;
      directors_loans: number;
      related_party_transactions: string;
      post_balance_sheet_events: string;
      contingent_liabilities: string;
      capital_commitments: string;
      pension_commitments: string;
      operating_lease_commitments: string;
      audit_exemption: string;
    };
    directors_report: {
      principal_activities: string;
      business_review: string;
      results_and_dividends: string;
      directors_and_secretary: Array<{ name: string; role: string }>;
      future_developments: string;
      post_balance_sheet_events: string;
      political_donations: string;
      accounting_records: string;
      statement_on_relevant_audit_information: string;
    };
  };

  /** 7. Revenue filings for this year */
  revenue_filings: Array<{
    return_type: string;
    status: string;
    filing_reference: string | null;
    submitted_at: string | null;
    summary_data: Record<string, unknown> | null;
  }>;

  /** 8. Corrections applied during this year */
  corrections: {
    user_corrections: Array<{
      vendor_pattern: string;
      original_category: string;
      corrected_category: string;
      transaction_count: number;
    }>;
    accountant_corrections: Array<{
      vendor_pattern: string;
      original_category: string;
      corrected_category: string;
      correction_count: number;
      analysis: Record<string, unknown> | null;
    }>;
  };

  /** 9. Journal entries for this year */
  journal_entries: Array<{
    entry_date: string;
    description: string;
    reference: string;
    entry_type: string;
    lines: Array<{
      account_name: string;
      debit: number;
      credit: number;
    }>;
  }>;

  /** 10. Period-end questionnaire responses */
  period_end_questionnaires: Array<{
    period_type: string;
    period_start: string;
    period_end: string;
    status: string;
    responses: Record<string, unknown>;
    accountant_notes: string | null;
  }>;

  /** 11. VAT finalisation data */
  vat_finalisation: Array<Record<string, unknown>>;

  /** 12. Debtor/creditor working papers */
  working_papers: {
    debtors: Array<{
      counterparty_name: string;
      amount: number;
      confirmed_amount: number | null;
      confirmation_status: string | null;
    }>;
    creditors: Array<{
      counterparty_name: string;
      amount: number;
      confirmed_amount: number | null;
      confirmation_status: string | null;
    }>;
  };

  /** 13. Company size classification & CRO filing requirements */
  company_size: CompanySizeResult;

  /** 14. Completeness checklist */
  completeness: {
    onboarding_complete: boolean;
    director_onboarding_complete: boolean;
    ct1_questionnaire_complete: boolean;
    form11_questionnaires_complete: boolean;
    all_transactions_reconciled: boolean;
    receipt_coverage_pct: number;
    journal_entries_count: number;
    corrections_count: number;
    revenue_filings_submitted: string[]; // e.g. ['CT1', 'VAT3']
  };
}

// ---------------------------------------------------------------------------
// Internal row types for tables not in the generated Supabase types
// ---------------------------------------------------------------------------

interface QuestionnaireRow {
  id: string;
  user_id: string;
  questionnaire_type: string;
  period_key: string;
  response_data: Record<string, unknown> | null;
}

interface YearEndSnapshotRow {
  id: string;
  user_id: string;
  tax_year: string;
  turnover?: number;
  cost_of_sales?: number;
  gross_profit?: number;
  total_expenses?: number;
  taxation?: number;
  [key: string]: unknown;
}

interface RevenueFilingRow {
  return_type: string;
  status: string;
  filing_reference: string | null;
  submitted_at: string | null;
  summary_data: Record<string, unknown> | null;
}

interface JournalEntryRow {
  id: string;
  user_id: string;
  entry_date: string;
  description: string;
  reference: string;
  entry_type: string;
  tax_year: number;
  [key: string]: unknown;
}

interface JournalEntryLineRow {
  id: string;
  journal_entry_id: string;
  account_name: string;
  debit: number;
  credit: number;
  [key: string]: unknown;
}

interface VatFinalisationRow {
  id: string;
  user_id: string;
  [key: string]: unknown;
}

interface DebtorCreditorPaperRow {
  id: string;
  user_id: string;
  tax_year: number;
  paper_type: string;
  [key: string]: unknown;
}

interface DebtorCreditorLineRow {
  counterparty_name: string;
  amount: number;
  confirmed_amount: number | null;
  confirmation_status: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helper: safe number coercion
// ---------------------------------------------------------------------------
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Assembles a complete audit trail snapshot for a given tax year.
 * Call this when finalising CRO annual accounts.
 *
 * Fetches from:
 *   profiles, onboarding_settings, director_onboarding,
 *   questionnaire_responses (CT1 + Form11), year_end_snapshots,
 *   revenue_filings, user_corrections, accountant_corrections,
 *   journal_entries + journal_entry_lines,
 *   period_end_questionnaires, vat_finalisation_data,
 *   debtor_creditor_papers + debtor_creditor_lines,
 *   transactions (for completeness stats)
 */
export async function assembleAuditSnapshot(
  clientUserId: string,
  taxYear: string,
): Promise<AuditTrailSnapshot> {
  const taxYearNum = parseInt(taxYear, 10);

  // ── Parallel fetch: main data ──────────────────────────────────────────
  const [
    profileRes,
    onboardingRes,
    directorsRes,
    ct1QuestionnaireRes,
    yearEndRes,
    revenueFilingsRes,
    userCorrectionsRes,
    accountantCorrectionsRes,
    journalEntriesRes,
    periodEndRes,
    vatFinRes,
    debtorPapersRes,
    creditorPapersRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", clientUserId)
      .maybeSingle(),

    supabase
      .from("onboarding_settings")
      .select("*")
      .eq("user_id", clientUserId)
      .maybeSingle(),

    supabase
      .from("director_onboarding")
      .select("*")
      .eq("user_id", clientUserId)
      .order("director_number"),

    supabase
      .from("questionnaire_responses" as never)
      .select("*")
      .eq("user_id", clientUserId)
      .eq("questionnaire_type", "ct1")
      .eq("period_key", taxYear)
      .maybeSingle() as Promise<{ data: QuestionnaireRow | null; error: unknown }>,

    supabase
      .from("year_end_snapshots" as never)
      .select("*")
      .eq("user_id", clientUserId)
      .eq("tax_year", taxYear)
      .maybeSingle() as Promise<{ data: YearEndSnapshotRow | null; error: unknown }>,

    supabase
      .from("revenue_filings" as never)
      .select("return_type, status, filing_reference, submitted_at, summary_data")
      .eq("user_id", clientUserId)
      .eq("tax_year", taxYear) as Promise<{ data: RevenueFilingRow[] | null; error: unknown }>,

    supabase
      .from("user_corrections")
      .select("*")
      .eq("user_id", clientUserId),

    supabase
      .from("accountant_corrections")
      .select("*")
      .eq("client_user_id", clientUserId),

    supabase
      .from("journal_entries" as never)
      .select("*")
      .eq("user_id", clientUserId)
      .eq("tax_year", taxYearNum)
      .order("entry_date") as Promise<{ data: JournalEntryRow[] | null; error: unknown }>,

    supabase
      .from("period_end_questionnaires")
      .select("*")
      .eq("client_user_id", clientUserId),

    supabase
      .from("vat_finalisation_data" as never)
      .select("*")
      .eq("user_id", clientUserId) as Promise<{ data: VatFinalisationRow[] | null; error: unknown }>,

    supabase
      .from("debtor_creditor_papers" as never)
      .select("*")
      .eq("user_id", clientUserId)
      .eq("tax_year", taxYearNum)
      .eq("paper_type", "debtors")
      .maybeSingle() as Promise<{ data: DebtorCreditorPaperRow | null; error: unknown }>,

    supabase
      .from("debtor_creditor_papers" as never)
      .select("*")
      .eq("user_id", clientUserId)
      .eq("tax_year", taxYearNum)
      .eq("paper_type", "creditors")
      .maybeSingle() as Promise<{ data: DebtorCreditorPaperRow | null; error: unknown }>,
  ]);

  // ── Form11 questionnaires for each director ────────────────────────────
  const directors = directorsRes.data ?? [];
  const form11Map: Record<string, Record<string, unknown>> = {};

  for (const dir of directors) {
    const { data } = (await supabase
      .from("questionnaire_responses" as never)
      .select("response_data")
      .eq("user_id", clientUserId)
      .eq("questionnaire_type", "form11")
      .eq("period_key", String(dir.director_number))
      .maybeSingle()) as { data: QuestionnaireRow | null; error: unknown };

    if (data?.response_data) {
      form11Map[String(dir.director_number)] = data.response_data;
    }
  }

  // ── Journal entry lines ────────────────────────────────────────────────
  const journalEntries = journalEntriesRes.data ?? [];
  const journalEntryIds = journalEntries.map((je) => je.id);
  let journalLines: JournalEntryLineRow[] = [];

  if (journalEntryIds.length > 0) {
    const { data } = (await supabase
      .from("journal_entry_lines" as never)
      .select("*")
      .in("journal_entry_id", journalEntryIds)) as {
      data: JournalEntryLineRow[] | null;
      error: unknown;
    };
    journalLines = data ?? [];
  }

  // ── Debtor/creditor lines ──────────────────────────────────────────────
  let debtorLines: DebtorCreditorLineRow[] = [];
  let creditorLines: DebtorCreditorLineRow[] = [];

  if (debtorPapersRes.data?.id) {
    const { data } = (await supabase
      .from("debtor_creditor_lines" as never)
      .select("counterparty_name, amount, confirmed_amount, confirmation_status")
      .eq("paper_id", debtorPapersRes.data.id)) as {
      data: DebtorCreditorLineRow[] | null;
      error: unknown;
    };
    debtorLines = data ?? [];
  }

  if (creditorPapersRes.data?.id) {
    const { data } = (await supabase
      .from("debtor_creditor_lines" as never)
      .select("counterparty_name, amount, confirmed_amount, confirmation_status")
      .eq("paper_id", creditorPapersRes.data.id)) as {
      data: DebtorCreditorLineRow[] | null;
      error: unknown;
    };
    creditorLines = data ?? [];
  }

  // ── Transaction completeness stats ─────────────────────────────────────
  const { count: totalTxns } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", clientUserId)
    .gte("transaction_date", `${taxYear}-01-01`)
    .lte("transaction_date", `${taxYear}-12-31`);

  const { count: reconciledTxns } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", clientUserId)
    .eq("is_reconciled", true)
    .gte("transaction_date", `${taxYear}-01-01`)
    .lte("transaction_date", `${taxYear}-12-31`);

  // ── Unpack data ────────────────────────────────────────────────────────
  const profile = profileRes.data;
  const onboarding = onboardingRes.data;
  const ct1Q = ct1QuestionnaireRes.data?.response_data ?? null;
  const yearEnd = yearEndRes.data;
  const q: Record<string, unknown> = ct1Q ?? {};
  const ye: Record<string, unknown> = (yearEnd as Record<string, unknown>) ?? {};

  // ── Compute abridged accounts ──────────────────────────────────────────

  // Balance sheet — fixed assets
  const fixedTangible =
    num(q.fixedAssetsPlantMachinery) +
    num(q.fixedAssetsMotorVehicles) +
    num(q.fixedAssetsFixturesFittings) +
    num(q.fixedAssetsLandBuildings);

  // Balance sheet — current assets
  const stockVal = num(q.currentAssetsStock);
  const debtorsVal = num(q.currentAssetsDebtors);
  const bankBalance = num(q.currentAssetsBankBalance);
  const cashVal = num(q.currentAssetsCash);
  const currentAssetsTotal = stockVal + debtorsVal + bankBalance + cashVal;

  // Creditors
  const creditorsWithin = num(q.liabilitiesCreditors) + num(q.liabilitiesTaxation);
  const netCurrentAssets = currentAssetsTotal - creditorsWithin;
  const creditorsAfter = num(q.liabilitiesBankLoans);
  const netAssets = fixedTangible + netCurrentAssets - creditorsAfter;

  // P&L from year_end_snapshot
  const turnover = num(ye.turnover);
  const costOfSales = num(ye.cost_of_sales);
  const grossProfit = num(ye.gross_profit) || turnover - costOfSales;
  const totalExpenses = num(ye.total_expenses);
  const operatingProfit = grossProfit - totalExpenses;
  const profitBeforeTax = operatingProfit;
  const taxation = num(ye.taxation);
  const profitAfterTax = profitBeforeTax - taxation;
  const dividendsPaid = num(q.dividendsPaidAmount);
  const retainedForYear = profitAfterTax - dividendsPaid;

  // Director salary totals
  const dirSalary = directors.reduce(
    (sum, d) => sum + (d.annual_salary ?? 0),
    0,
  );

  // Pension check across director onboarding_data
  const hasPension = directors.some((d) => {
    const data = d.onboarding_data as Record<string, unknown> | null;
    if (!data) return false;
    const reliefs = data.reliefs;
    return (
      Array.isArray(reliefs) &&
      (reliefs as string[]).includes("pension_contributions")
    );
  });

  // ── Assemble snapshot ──────────────────────────────────────────────────

  const userCorrData = userCorrectionsRes.data ?? [];
  const acctCorrData = accountantCorrectionsRes.data ?? [];
  const revFilings = revenueFilingsRes.data ?? [];
  const periodEndData = periodEndRes.data ?? [];
  const vatFinData = (vatFinRes.data ?? []) as Record<string, unknown>[];

  const snapshot: AuditTrailSnapshot = {
    snapshot_date: new Date().toISOString(),
    snapshot_by: "", // filled by caller
    tax_year: taxYear,

    company_profile: {
      business_name: profile?.business_name ?? "",
      business_type: profile?.business_type ?? "",
      vat_number: profile?.vat_number ?? null,
      address: profile?.address ?? null,
      phone: profile?.phone ?? null,
      email: profile?.email ?? null,
    },

    onboarding: {
      industry: onboarding?.industry ?? null,
      has_employees: onboarding?.has_employees ?? false,
      employee_count: onboarding?.employee_count ?? null,
      vat_registered: onboarding?.vat_registered ?? false,
      vat_basis: onboarding?.vat_basis ?? null,
      vat_frequency: onboarding?.vat_frequency ?? null,
      vat_rates_used: onboarding?.vat_rates_used ?? null,
      uses_subcontractors: onboarding?.uses_subcontractors ?? false,
      eu_trade_enabled: onboarding?.eu_trade_enabled ?? false,
      payroll_frequency: onboarding?.payroll_frequency ?? null,
      year_end: onboarding?.year_end ?? null,
      income_streams: onboarding?.income_streams ?? null,
      expense_types: onboarding?.expense_types ?? null,
    },

    directors: directors.map((d) => ({
      director_number: d.director_number,
      director_name: d.director_name ?? "",
      pps_number: d.pps_number ?? "",
      date_of_birth: d.date_of_birth ?? "",
      marital_status: d.marital_status ?? "",
      assessment_basis: d.assessment_basis ?? "",
      annual_salary: d.annual_salary ?? 0,
      receives_dividends: d.receives_dividends ?? false,
      estimated_dividends: d.estimated_dividends ?? 0,
      onboarding_data: (d.onboarding_data ?? {}) as Record<string, unknown>,
    })),

    questionnaires: {
      ct1: ct1Q,
      form11: form11Map,
    },

    year_end_snapshot: (yearEnd as Record<string, unknown>) ?? null,

    abridged_accounts: {
      balance_sheet: {
        fixed_assets: {
          tangible: fixedTangible,
          intangible: 0,
          investments: 0,
          total: fixedTangible,
        },
        current_assets: {
          stock: stockVal,
          debtors: debtorsVal,
          cash_at_bank: bankBalance + cashVal,
          other: 0,
          total: currentAssetsTotal,
        },
        creditors_amounts_falling_due_within_one_year: creditorsWithin,
        net_current_assets: netCurrentAssets,
        total_assets_less_current_liabilities: fixedTangible + netCurrentAssets,
        creditors_amounts_falling_due_after_one_year: creditorsAfter,
        provisions_for_liabilities: 0,
        net_assets: netAssets,
        capital_and_reserves: {
          called_up_share_capital: 100,
          share_premium: 0,
          profit_and_loss_account: netAssets - 100,
          other_reserves: 0,
          shareholders_funds: netAssets,
        },
      },
      profit_and_loss: {
        turnover,
        cost_of_sales: costOfSales,
        gross_profit: grossProfit,
        distribution_costs: 0,
        administrative_expenses: totalExpenses,
        other_operating_income: 0,
        operating_profit: operatingProfit,
        interest_receivable: 0,
        interest_payable: 0,
        profit_on_ordinary_activities_before_tax: profitBeforeTax,
        tax_on_profit: taxation,
        profit_for_the_financial_year: profitAfterTax,
        dividends_paid: dividendsPaid,
        retained_profit_for_year: retainedForYear,
        retained_profit_brought_forward: 0,
        retained_profit_carried_forward: netAssets - 100,
      },
      notes_to_accounts: {
        basis_of_preparation:
          "These financial statements have been prepared in accordance with FRS 102 Section 1A (Small Entities) and the Companies Act 2014.",
        accounting_convention:
          "The financial statements have been prepared under the historical cost convention.",
        revenue_recognition:
          "Revenue is recognised when services are rendered or goods are delivered to the customer.",
        tangible_fixed_assets:
          "Tangible fixed assets are stated at cost less accumulated depreciation.",
        depreciation_rates: {
          "Motor vehicles": "12.5% straight line",
          "Plant & machinery": "12.5% straight line",
          "Fixtures & fittings": "12.5% straight line",
        },
        stock_valuation:
          "Stock is valued at the lower of cost and net realisable value.",
        taxation:
          "Current tax is provided at amounts expected to be paid using the tax rates and laws enacted at the balance sheet date.",
        going_concern:
          "The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future. The company therefore continues to adopt the going concern basis in preparing its financial statements.",
        average_employees: onboarding?.employee_count ?? 1,
        staff_costs: dirSalary,
        directors_remuneration: dirSalary,
        directors_loans: num(q.liabilitiesDirectorsLoans),
        related_party_transactions:
          "The director is remunerated as disclosed. No other related party transactions occurred during the year.",
        post_balance_sheet_events:
          "No significant events have occurred since the year end that would require adjustment to or disclosure in the financial statements.",
        contingent_liabilities:
          "There are no contingent liabilities at the year end.",
        capital_commitments:
          "There are no capital commitments at the year end.",
        pension_commitments: hasPension
          ? "The company operates a defined contribution pension scheme. Pension costs charged to the profit and loss account represent the contributions payable during the year."
          : "The company has no pension commitments.",
        operating_lease_commitments:
          "The company has no material operating lease commitments.",
        audit_exemption:
          "The company has availed of the audit exemption provided for by Section 352 of the Companies Act 2014.",
      },
      directors_report: {
        principal_activities: `The principal activity of the company is ${
          onboarding?.industry ?? profile?.business_type ?? "general trading"
        }.`,
        business_review: `The company had a satisfactory year with turnover of EUR${turnover.toLocaleString()}.`,
        results_and_dividends:
          dividendsPaid > 0
            ? `The profit for the financial year amounted to EUR${profitAfterTax.toLocaleString()}. Dividends of EUR${dividendsPaid.toLocaleString()} were paid during the year.`
            : `The profit for the financial year amounted to EUR${profitAfterTax.toLocaleString()}. No dividends were declared during the year.`,
        directors_and_secretary: directors.map((d) => ({
          name: d.director_name ?? "",
          role: "Director",
        })),
        future_developments:
          "The directors intend to continue the present level of activity.",
        post_balance_sheet_events:
          "No significant events have occurred since the year end.",
        political_donations:
          "The company made no political donations during the year.",
        accounting_records:
          "The directors are responsible for ensuring that proper books of account are kept by the company as required by Sections 281 to 285 of the Companies Act 2014. The books of account are maintained at the company's registered office.",
        statement_on_relevant_audit_information:
          "The company has availed of the audit exemption under Section 352 of the Companies Act 2014.",
      },
    },

    revenue_filings: revFilings.map((f) => ({
      return_type: f.return_type,
      status: f.status,
      filing_reference: f.filing_reference,
      submitted_at: f.submitted_at,
      summary_data: f.summary_data,
    })),

    corrections: {
      user_corrections: userCorrData.map((c) => ({
        vendor_pattern: c.vendor_pattern,
        original_category: c.original_category ?? "",
        corrected_category: c.corrected_category,
        transaction_count: c.transaction_count ?? 0,
      })),
      accountant_corrections: acctCorrData.map((c) => ({
        vendor_pattern: c.vendor_pattern,
        original_category: c.original_category ?? "",
        corrected_category: c.corrected_category,
        correction_count: c.correction_count,
        analysis: null, // field not in table schema; reserved for future use
      })),
    },

    journal_entries: journalEntries.map((je) => ({
      entry_date: je.entry_date,
      description: je.description,
      reference: je.reference,
      entry_type: je.entry_type,
      lines: journalLines
        .filter((l) => l.journal_entry_id === je.id)
        .map((l) => ({
          account_name: l.account_name,
          debit: num(l.debit),
          credit: num(l.credit),
        })),
    })),

    period_end_questionnaires: periodEndData.map((p) => ({
      period_type: p.period_type,
      period_start: p.period_start,
      period_end: p.period_end,
      status: p.status,
      responses: (p.responses ?? {}) as Record<string, unknown>,
      accountant_notes: p.accountant_notes,
    })),

    vat_finalisation: vatFinData,

    working_papers: {
      debtors: debtorLines.map((l) => ({
        counterparty_name: l.counterparty_name,
        amount: num(l.amount),
        confirmed_amount:
          l.confirmed_amount != null ? num(l.confirmed_amount) : null,
        confirmation_status: l.confirmation_status,
      })),
      creditors: creditorLines.map((l) => ({
        counterparty_name: l.counterparty_name,
        amount: num(l.amount),
        confirmed_amount:
          l.confirmed_amount != null ? num(l.confirmed_amount) : null,
        confirmation_status: l.confirmation_status,
      })),
    },

    company_size: classifyCompanySize({
      balanceSheetTotal: fixedTangible + currentAssetsTotal,
      netTurnover: turnover,
      averageEmployees: onboarding?.employee_count ?? 1,
    }),

    completeness: {
      onboarding_complete: onboarding?.onboarding_completed ?? false,
      director_onboarding_complete: directors.every(
        (d) => d.onboarding_completed === true,
      ),
      ct1_questionnaire_complete: ct1Q?.finalDeclaration === true,
      form11_questionnaires_complete: Object.values(form11Map).every(
        (f) => f.finalDeclaration === true,
      ),
      all_transactions_reconciled:
        totalTxns != null && totalTxns > 0 && totalTxns === reconciledTxns,
      receipt_coverage_pct:
        totalTxns != null && totalTxns > 0
          ? Math.round(((reconciledTxns ?? 0) / totalTxns) * 100)
          : 0,
      journal_entries_count: journalEntries.length,
      corrections_count: userCorrData.length + acctCorrData.length,
      revenue_filings_submitted: revFilings
        .filter((f) => f.status === "filed")
        .map((f) => f.return_type),
    },
  };

  return snapshot;
}
