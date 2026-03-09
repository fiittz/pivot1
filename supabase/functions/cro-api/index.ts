/**
 * CRO (Companies Registration Office) API edge function.
 *
 * Actions:
 *   search_companies  — Search CRO company register
 *   get_company        — Get a single company by number
 *   get_filings        — Get filing submissions for a company
 *   sync_company       — Sync company + filings into local DB
 *   extract_accounts_pdf — Extract structured data from filed accounts PDF
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRO_API_EMAIL = Deno.env.get("CRO_API_EMAIL") || "";
const CRO_API_KEY = Deno.env.get("CRO_API_KEY") || "";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const IS_MOCK = !CRO_API_EMAIL || !CRO_API_KEY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  error: string,
  status: number,
  detail?: string
): Response {
  return jsonResponse({ error, ...(detail ? { detail } : {}) }, status);
}

/**
 * Call the CRO Company Web Service with Basic auth.
 */
async function croFetch(path: string): Promise<unknown> {
  const credentials = btoa(`${CRO_API_EMAIL}:${CRO_API_KEY}`);
  const res = await fetch(`https://services.cro.ie/cws/${path}`, {
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CRO API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock data (returned when CRO_API_EMAIL / CRO_API_KEY are not configured)
// ---------------------------------------------------------------------------

const MOCK_OAKMONT_COMPANY = {
  company_num: "654321",
  company_name: "OAKMONT CONSULTING LIMITED",
  company_status: "Normal",
  company_status_date: "2019-03-15",
  company_type: "Private Company Limited by Shares",
  company_reg_date: "2019-03-15",
  last_annual_return_date: "2024-03-15",
  next_annual_return_date: "2025-03-15",
  last_accounts_date: "2024-12-31",
  address: "Unit 4, Oakmont Business Park, Sandyford, Dublin 18, D18 Y2X7",
  company_bus_ind: "C",
};

const MOCK_OAKMONT_FILINGS = [
  {
    submission_id: "SUB-2024-001",
    form_type: "B1",
    description: "Annual Return",
    effective_date: "2024-03-15",
    status: "Registered",
    received_date: "2024-04-01",
  },
  {
    submission_id: "SUB-2024-002",
    form_type: "B73",
    description: "Financial Statements (Abridged)",
    effective_date: "2023-12-31",
    status: "Registered",
    received_date: "2024-04-01",
  },
  {
    submission_id: "SUB-2023-001",
    form_type: "B1",
    description: "Annual Return",
    effective_date: "2023-03-15",
    status: "Registered",
    received_date: "2023-03-28",
  },
  {
    submission_id: "SUB-2022-001",
    form_type: "B1",
    description: "Annual Return",
    effective_date: "2022-03-15",
    status: "Registered",
    received_date: "2022-03-25",
  },
];

function getMockSearchResults(companyName?: string, companyNum?: string): unknown {
  if (companyNum === "654321") {
    return { companies: [MOCK_OAKMONT_COMPANY] };
  }
  if (
    companyName &&
    companyName.toLowerCase().includes("oakmont")
  ) {
    return { companies: [MOCK_OAKMONT_COMPANY] };
  }
  // Return empty results for non-matching searches
  return { companies: [] };
}

function getMockCompany(companyNum: string): unknown {
  if (companyNum === "654321") {
    return MOCK_OAKMONT_COMPANY;
  }
  return null;
}

function getMockFilings(companyNum: string): unknown {
  if (companyNum === "654321") {
    return { submissions: MOCK_OAKMONT_FILINGS };
  }
  return { submissions: [] };
}

// ---------------------------------------------------------------------------
// Action: search_companies
// ---------------------------------------------------------------------------

async function handleSearchCompanies(params: {
  company_name?: string;
  company_num?: string;
  max?: number;
}): Promise<Response> {
  const { company_name, company_num, max = 20 } = params;

  if (!company_name && !company_num) {
    return errorResponse(
      "Either company_name or company_num is required.",
      400
    );
  }

  if (IS_MOCK) {
    console.log("[cro-api] Mock mode — returning demo data for search");
    const results = getMockSearchResults(company_name, company_num);
    return jsonResponse({ data: results, mock: true });
  }

  const queryParts: string[] = [];
  if (company_name) queryParts.push(`company_name=${encodeURIComponent(company_name)}`);
  if (company_num) queryParts.push(`company_num=${encodeURIComponent(company_num)}`);
  queryParts.push("company_bus_ind=C");
  queryParts.push(`max=${max}`);
  queryParts.push("format=json");

  const data = await croFetch(`companies?${queryParts.join("&")}`);
  return jsonResponse({ data });
}

// ---------------------------------------------------------------------------
// Action: get_company
// ---------------------------------------------------------------------------

async function handleGetCompany(params: {
  company_num: string;
}): Promise<Response> {
  const { company_num } = params;

  if (!company_num) {
    return errorResponse("company_num is required.", 400);
  }

  if (IS_MOCK) {
    console.log(`[cro-api] Mock mode — returning demo data for company ${company_num}`);
    const data = getMockCompany(company_num);
    if (!data) {
      return errorResponse("Company not found (mock).", 404);
    }
    return jsonResponse({ data, mock: true });
  }

  const data = await croFetch(
    `company/${encodeURIComponent(company_num)}/C?format=json`
  );
  return jsonResponse({ data });
}

// ---------------------------------------------------------------------------
// Action: get_filings
// ---------------------------------------------------------------------------

async function handleGetFilings(params: {
  company_num: string;
}): Promise<Response> {
  const { company_num } = params;

  if (!company_num) {
    return errorResponse("company_num is required.", 400);
  }

  if (IS_MOCK) {
    console.log(`[cro-api] Mock mode — returning demo filings for company ${company_num}`);
    const data = getMockFilings(company_num);
    return jsonResponse({ data, mock: true });
  }

  const data = await croFetch(
    `submissions?company_num=${encodeURIComponent(company_num)}&company_bus_ind=C&format=json`
  );
  return jsonResponse({ data });
}

// ---------------------------------------------------------------------------
// Action: sync_company
// ---------------------------------------------------------------------------

async function handleSyncCompany(
  supabase: ReturnType<typeof createClient>,
  params: { company_num: string; user_id?: string }
): Promise<Response> {
  const { company_num, user_id } = params;

  if (!company_num) {
    return errorResponse("company_num is required.", 400);
  }

  // Fetch company details
  let companyData: Record<string, unknown>;
  let filingsData: Record<string, unknown>;

  if (IS_MOCK) {
    console.log(`[cro-api] Mock mode — syncing demo company ${company_num}`);
    const mockCo = getMockCompany(company_num);
    if (!mockCo) {
      return errorResponse("Company not found (mock).", 404);
    }
    companyData = mockCo as Record<string, unknown>;
    filingsData = getMockFilings(company_num) as Record<string, unknown>;
  } else {
    companyData = (await croFetch(
      `company/${encodeURIComponent(company_num)}/C?format=json`
    )) as Record<string, unknown>;
    filingsData = (await croFetch(
      `submissions?company_num=${encodeURIComponent(company_num)}&company_bus_ind=C&format=json`
    )) as Record<string, unknown>;
  }

  const now = new Date().toISOString();

  // Upsert into cro_companies
  const companyRow = {
    company_num,
    company_name: companyData.company_name ?? null,
    company_status: companyData.company_status ?? null,
    company_status_date: companyData.company_status_date ?? null,
    company_type: companyData.company_type ?? null,
    company_reg_date: companyData.company_reg_date ?? null,
    last_annual_return_date: companyData.last_annual_return_date ?? null,
    next_annual_return_date: companyData.next_annual_return_date ?? null,
    last_accounts_date: companyData.last_accounts_date ?? null,
    address: companyData.address ?? null,
    raw_data: companyData,
    last_synced_at: now,
    updated_at: now,
  };

  const { data: upsertedCompany, error: upsertError } = await supabase
    .from("cro_companies")
    .upsert(companyRow, { onConflict: "company_num" })
    .select()
    .single();

  if (upsertError) {
    console.error("[cro-api] Failed to upsert company:", upsertError);
    throw upsertError;
  }

  // Link user if provided
  if (user_id && upsertedCompany) {
    await supabase
      .from("cro_companies")
      .update({ user_id })
      .eq("id", upsertedCompany.id);
  }

  // Sync filings: delete old filings for this company, then re-insert
  const submissions = (filingsData.submissions as Array<Record<string, unknown>>) ?? [];

  if (upsertedCompany) {
    // Delete existing filings for this company
    await supabase
      .from("cro_filings")
      .delete()
      .eq("cro_company_id", upsertedCompany.id);

    // Insert new filings
    if (submissions.length > 0) {
      const filingRows = submissions.map((s) => ({
        cro_company_id: upsertedCompany.id,
        submission_id: s.submission_id ?? s.submissionId ?? null,
        form_type: s.form_type ?? s.formType ?? null,
        description: s.description ?? null,
        effective_date: s.effective_date ?? s.effectiveDate ?? null,
        status: s.status ?? null,
        received_date: s.received_date ?? s.receivedDate ?? null,
        raw_data: s,
      }));

      const { error: filingsError } = await supabase
        .from("cro_filings")
        .insert(filingRows);

      if (filingsError) {
        console.error("[cro-api] Failed to insert filings:", filingsError);
        // Non-fatal — company was already synced
      }
    }
  }

  console.log(
    `[cro-api] sync_company num=${company_num}, name=${companyData.company_name}, filings=${submissions.length}`
  );

  return jsonResponse({
    data: upsertedCompany,
    filings_count: submissions.length,
    mock: IS_MOCK,
  });
}

// ---------------------------------------------------------------------------
// Action: extract_accounts_pdf
// ---------------------------------------------------------------------------

async function handleExtractAccountsPdf(
  supabase: ReturnType<typeof createClient>,
  params: {
    cro_company_id: string;
    financial_year_end: string;
    pdf_base64: string;
  }
): Promise<Response> {
  const { cro_company_id, financial_year_end, pdf_base64 } = params;

  if (!cro_company_id || !financial_year_end || !pdf_base64) {
    return errorResponse(
      "cro_company_id, financial_year_end, and pdf_base64 are all required.",
      400
    );
  }

  if (!OPENROUTER_API_KEY) {
    return errorResponse(
      "OPENROUTER_API_KEY is not configured. Cannot extract accounts.",
      500
    );
  }

  // Verify the company exists
  const { data: company, error: companyError } = await supabase
    .from("cro_companies")
    .select("id, company_num, company_name")
    .eq("id", cro_company_id)
    .single();

  if (companyError || !company) {
    return errorResponse("CRO company not found.", 404);
  }

  // Store PDF in Supabase Storage
  const pdfBytes = Uint8Array.from(atob(pdf_base64), (c) => c.charCodeAt(0));
  const storagePath = `${company.company_num}/${financial_year_end}.pdf`;

  const { error: storageError } = await supabase.storage
    .from("cro-accounts-pdfs")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (storageError) {
    console.error("[cro-api] PDF storage error:", storageError);
    // Non-fatal — continue with extraction
  }

  // Create/update the annual accounts row as 'processing'
  const { data: accountsRow, error: accountsError } = await supabase
    .from("cro_annual_accounts")
    .upsert(
      {
        cro_company_id,
        financial_year_end,
        pdf_storage_path: storagePath,
        extraction_status: "processing",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cro_company_id,financial_year_end" }
    )
    .select()
    .single();

  if (accountsError) {
    console.error("[cro-api] Failed to create accounts row:", accountsError);
    throw accountsError;
  }

  // Call OpenRouter (Claude) for structured extraction
  console.log(
    `[cro-api] extract_accounts_pdf company=${company.company_name}, year_end=${financial_year_end}`
  );

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4-20250514",
      messages: [
        {
          role: "system",
          content:
            "You are a chartered accountant extracting structured data from Irish company financial statements filed with the CRO. Extract all balance sheet lines, P&L summary, and notes to the accounts. Return valid JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all financial data and notes from these filed accounts for ${company.company_name} (CRO ${company.company_num}), financial year ending ${financial_year_end}. Return JSON matching this schema: { fixed_assets_tangible, fixed_assets_intangible, fixed_assets_investments, current_assets_stock, current_assets_debtors, current_assets_cash, current_assets_other, creditors_within_one_year, net_current_assets, creditors_after_one_year, provisions_for_liabilities, net_assets, share_capital, share_premium, retained_profits, other_reserves, shareholders_funds, turnover, cost_of_sales, gross_profit, operating_expenses, operating_profit, interest_payable, profit_before_tax, taxation, profit_after_tax, dividends_paid, retained_profit_for_year, notes: { accounting_policies: { basis_of_preparation, revenue_recognition, depreciation, going_concern }, directors_report: { principal_activities, review_of_business, future_developments, dividends, post_balance_sheet_events }, directors: [{ name, appointed_date, resigned_date }], secretary: { name }, auditor_name, audit_opinion, employees: { avg_number, staff_costs }, director_remuneration, related_party_transactions, contingent_liabilities, capital_commitments, going_concern, loans_to_directors, pension_commitments, lease_commitments, ultimate_parent, depreciation_policy, stock_valuation_method, custom_notes: [{ title, content }] }, confidence: 0.0-1.0 }`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdf_base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4000,
    }),
  });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("[cro-api] AI extraction error:", aiRes.status, errText);

    await supabase
      .from("cro_annual_accounts")
      .update({
        extraction_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountsRow.id);

    return errorResponse(
      "AI extraction failed",
      502,
      `OpenRouter returned ${aiRes.status}`
    );
  }

  const aiResult = await aiRes.json();
  const content = aiResult.choices?.[0]?.message?.content ?? "{}";

  let extractedData: Record<string, unknown>;
  try {
    // Strip markdown code fences if present
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    extractedData = JSON.parse(cleaned);
  } catch {
    console.error("[cro-api] Failed to parse AI response:", content);

    await supabase
      .from("cro_annual_accounts")
      .update({
        extraction_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountsRow.id);

    return errorResponse("Failed to parse extracted data from AI response.", 500);
  }

  const confidence = (extractedData.confidence as number) ?? 0.5;

  // Update the accounts row with extracted data
  await supabase
    .from("cro_annual_accounts")
    .update({
      extracted_data: extractedData,
      extraction_status: "completed",
      extraction_confidence: Math.round(confidence * 100),
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountsRow.id);

  console.log(
    `[cro-api] extract_accounts_pdf completed for ${company.company_name} year_end=${financial_year_end}, confidence=${(confidence * 100).toFixed(0)}%`
  );

  return jsonResponse({
    data: extractedData,
    accounts_id: accountsRow.id,
    extraction_status: "completed",
    extraction_confidence: Math.round(confidence * 100),
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Auth client — verify the JWT
    const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limit: 20 requests per minute
    const rl = checkRateLimit(user.id, "cro-api", 20);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    // Service role client for DB operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { action, ...params } = await req.json();

    switch (action) {
      case "search_companies":
        return await handleSearchCompanies(params as any);

      case "get_company":
        return await handleGetCompany(params as any);

      case "get_filings":
        return await handleGetFilings(params as any);

      case "sync_company":
        return await handleSyncCompany(supabase, {
          ...(params as any),
          user_id: (params as any).user_id || user.id,
        });

      case "extract_accounts_pdf":
        return await handleExtractAccountsPdf(supabase, params as any);

      default:
        return errorResponse(
          `Invalid action: ${action}. Valid actions: search_companies, get_company, get_filings, sync_company, extract_accounts_pdf`,
          400
        );
    }
  } catch (error) {
    console.error("[cro-api] Unhandled error:", error);
    const message =
      error instanceof Error ? error.message : "An internal error occurred";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
