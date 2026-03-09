export interface CROCompany {
  id: string;
  user_id: string | null;
  company_num: string;
  company_name: string;
  company_status_desc: string | null;
  company_status_code: number | null;
  comp_type_desc: string | null;
  company_type_code: number | null;
  company_reg_date: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  address_line4: string | null;
  eircode: string | null;
  last_ar_date: string | null;
  next_ar_date: string | null;
  last_acc_date: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
  auto_sync_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CROFiling {
  id: string;
  cro_company_id: string;
  doc_id: string | null;
  sub_num: string | null;
  sub_type_desc: string;
  doc_type_desc: string | null;
  sub_status_desc: string | null;
  sub_received_date: string | null;
  sub_effective_date: string | null;
  acc_year_to_date: string | null;
  num_pages: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface CROAccountNotes {
  accounting_policies?: {
    basis_of_preparation?: string;
    revenue_recognition?: string;
    depreciation?: string;
    going_concern?: string;
  };
  directors_report?: {
    principal_activities?: string;
    review_of_business?: string;
    future_developments?: string;
    dividends?: string;
    post_balance_sheet_events?: string;
  };
  directors?: Array<{ name: string; appointed_date?: string; resigned_date?: string }>;
  secretary?: { name: string };
  auditor_name?: string;
  audit_opinion?: "unqualified" | "qualified" | "adverse" | "disclaimer" | "exempt";
  employees?: { avg_number?: number; staff_costs?: number };
  director_remuneration?: number;
  related_party_transactions?: string;
  contingent_liabilities?: string;
  capital_commitments?: string;
  going_concern?: string;
  loans_to_directors?: number;
  pension_commitments?: string;
  lease_commitments?: string;
  ultimate_parent?: string;
  depreciation_policy?: string;
  stock_valuation_method?: string;
  custom_notes?: Array<{ title: string; content: string }>;
}

export interface CROAnnualAccounts {
  id: string;
  cro_company_id: string;
  cro_filing_id: string | null;
  financial_year_end: string;
  period_start: string | null;
  data_source: "manual" | "balnce_auto" | "pdf_extraction" | "accountant_import";
  // Balance Sheet
  fixed_assets_tangible: number | null;
  fixed_assets_intangible: number | null;
  fixed_assets_investments: number | null;
  current_assets_stock: number | null;
  current_assets_debtors: number | null;
  current_assets_cash: number | null;
  current_assets_other: number | null;
  creditors_within_one_year: number | null;
  net_current_assets: number | null;
  creditors_after_one_year: number | null;
  provisions_for_liabilities: number | null;
  net_assets: number | null;
  share_capital: number | null;
  share_premium: number | null;
  retained_profits: number | null;
  other_reserves: number | null;
  shareholders_funds: number | null;
  // P&L
  turnover: number | null;
  cost_of_sales: number | null;
  gross_profit: number | null;
  operating_expenses: number | null;
  operating_profit: number | null;
  interest_payable: number | null;
  profit_before_tax: number | null;
  taxation: number | null;
  profit_after_tax: number | null;
  dividends_paid: number | null;
  retained_profit_for_year: number | null;
  // Notes
  notes: CROAccountNotes;
  // PDF
  pdf_storage_path: string | null;
  extraction_status: "pending" | "processing" | "completed" | "failed" | null;
  extraction_confidence: number | null;
  // Review
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

// CRO API search result (raw from API)
export interface CROSearchResult {
  company_num: number;
  company_bus_ind: string;
  company_name: string;
  company_addr_1: string;
  company_addr_2: string;
  company_addr_3: string;
  company_addr_4: string;
  company_reg_date: string;
  company_status_desc: string;
  company_status_date: string;
  last_ar_date: string;
  next_ar_date: string;
  last_acc_date: string;
  comp_type_desc: string;
  company_type_code: number;
  company_status_code: number;
  eircode: string;
}

/** AR deadline status for dashboard widgets */
export type ARStatus = "ok" | "due_soon" | "overdue";

export function getARStatus(nextArDate: string | null): ARStatus {
  if (!nextArDate) return "overdue";
  const next = new Date(nextArDate);
  const now = new Date();
  const daysUntil = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 60) return "due_soon";
  return "ok";
}
