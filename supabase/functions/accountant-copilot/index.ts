/**
 * Accountant Co-Pilot — generates contextual suggestions for a client filing.
 *
 * POST { client_user_id, filing_type, tax_year, action }
 *
 * Actions:
 *   "review_filing"       — Full filing review with categorisation checks, relief scan, compliance
 *   "check_categorization" — Focus on miscategorised transactions
 *   "suggest_reliefs"      — Focus on missed reliefs and deductions
 *
 * Returns: { suggestions: CopilotSuggestion[] }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const CHAT_MODEL = Deno.env.get("COPILOT_MODEL") || "anthropic/claude-sonnet-4-5";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Data Assembly ─────────────────────────────────────────────

async function assembleClientContext(clientUserId: string, filingType: string, taxYear: number) {
  // Parallel queries for client data
  const [
    profileRes,
    onboardingRes,
    transactionsRes,
    correctionsRes,
    finalizationRes,
    categoriesRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", clientUserId).single(),
    supabase.from("onboarding_settings").select("*").eq("user_id", clientUserId).single(),
    supabase
      .from("transactions")
      .select("id, description, amount, date, category, category_id, type, vat_rate, receipt_url, vendor")
      .eq("user_id", clientUserId)
      .order("date", { ascending: false })
      .limit(500),
    supabase
      .from("accountant_corrections")
      .select("*")
      .eq("client_user_id", clientUserId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("finalization_requests")
      .select("*")
      .eq("user_id", clientUserId)
      .eq("report_type", filingType)
      .eq("tax_year", taxYear)
      .maybeSingle(),
    supabase.from("categories").select("id, name, parent_id"),
  ]);

  const profile = profileRes.data;
  const onboarding = onboardingRes.data;
  const transactions = transactionsRes.data || [];
  const corrections = correctionsRes.data || [];
  const finalization = finalizationRes.data;
  const categories = categoriesRes.data || [];

  // Build category lookup
  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    categoryMap[cat.id] = cat.name;
  }

  // Get industry-similar corrections (from other clients in same industry)
  const industry = onboarding?.business_type || onboarding?.industry;
  let industryCorrections: any[] = [];
  if (industry) {
    const { data } = await supabase
      .from("accountant_corrections")
      .select("vendor_pattern, corrected_category, corrected_vat_rate, correction_count, client_industry")
      .eq("client_industry", industry)
      .neq("client_user_id", clientUserId)
      .order("correction_count", { ascending: false })
      .limit(50);
    industryCorrections = data || [];
  }

  // Expense analysis
  const expenses = transactions.filter((t: any) => t.type === "expense");
  const income = transactions.filter((t: any) => t.type === "income");
  const uncategorised = expenses.filter(
    (t: any) => !t.category || t.category === "Uncategorised",
  );
  const withReceipts = expenses.filter((t: any) => t.receipt_url);
  const withoutReceipts = expenses.filter((t: any) => !t.receipt_url);

  // Group expenses by category
  const expenseByCategory: Record<string, { count: number; total: number }> = {};
  for (const t of expenses) {
    const cat = t.category || "Uncategorised";
    if (!expenseByCategory[cat]) expenseByCategory[cat] = { count: 0, total: 0 };
    expenseByCategory[cat].count++;
    expenseByCategory[cat].total += Math.abs(t.amount || 0);
  }

  // Income total
  const totalIncome = income.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0);

  // Build context string
  const lines: string[] = [];
  lines.push(`## Client: ${onboarding?.company_name || profile?.full_name || "Unknown"}`);
  lines.push(`Industry: ${onboarding?.business_type || "Not specified"}`);
  lines.push(`Filing: ${filingType.toUpperCase()} for tax year ${taxYear}`);
  lines.push(`VAT registered: ${onboarding?.vat_registered ? "Yes" : "No"}`);
  lines.push(`RCT registered: ${onboarding?.rct_registered ? "Yes" : "No"}`);
  lines.push("");

  lines.push("## Financial Summary");
  lines.push(`Total income: €${totalIncome.toFixed(2)}`);
  lines.push(`Total expenses: €${totalExpenses.toFixed(2)}`);
  lines.push(`Trading profit: €${(totalIncome - totalExpenses).toFixed(2)}`);
  lines.push(`Transactions: ${transactions.length} (${expenses.length} expenses, ${income.length} income)`);
  lines.push(`Receipt coverage: ${withReceipts.length}/${expenses.length} (${expenses.length > 0 ? Math.round((withReceipts.length / expenses.length) * 100) : 0}%)`);
  lines.push(`Uncategorised: ${uncategorised.length}`);
  lines.push("");

  lines.push("## Expenses by Category");
  const sortedCats = Object.entries(expenseByCategory).sort((a, b) => b[1].total - a[1].total);
  for (const [cat, { count, total }] of sortedCats) {
    lines.push(`- ${cat}: €${total.toFixed(2)} (${count} transactions)`);
  }
  lines.push("");

  // Show recent corrections by this accountant for this client
  if (corrections.length > 0) {
    lines.push("## Accountant's Prior Corrections (this client)");
    for (const c of corrections.slice(0, 20)) {
      lines.push(
        `- "${c.vendor_pattern}": ${c.original_category || "?"} → ${c.corrected_category} (×${c.correction_count})`,
      );
    }
    lines.push("");
  }

  // Show industry patterns from other clients
  if (industryCorrections.length > 0) {
    lines.push("## Industry Patterns (other clients in same industry)");
    for (const c of industryCorrections.slice(0, 15)) {
      lines.push(
        `- "${c.vendor_pattern}" → ${c.corrected_category} (corrected ${c.correction_count}× across clients)`,
      );
    }
    lines.push("");
  }

  // Finalization questionnaire answers
  if (finalization?.questionnaire_data && Object.keys(finalization.questionnaire_data).length > 0) {
    lines.push("## Client Questionnaire Answers");
    for (const [key, value] of Object.entries(finalization.questionnaire_data as Record<string, unknown>)) {
      if (value !== null && value !== undefined && value !== "") {
        lines.push(`- ${key}: ${JSON.stringify(value)}`);
      }
    }
    lines.push("");
  }

  // Sample transactions for review (focus on uncategorised + large expenses + potential issues)
  const reviewTransactions = [
    ...uncategorised.slice(0, 20),
    ...expenses
      .filter((t: any) => t.category && t.category !== "Uncategorised")
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 30),
  ];

  // Deduplicate
  const seen = new Set<string>();
  const uniqueReview = reviewTransactions.filter((t: any) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  lines.push("## Transactions to Review");
  for (const t of uniqueReview.slice(0, 50)) {
    lines.push(
      `- [${t.date}] ${t.description} | €${Math.abs(t.amount || 0).toFixed(2)} | Category: ${t.category || "UNCATEGORISED"} | VAT: ${t.vat_rate ?? "?"} | Receipt: ${t.receipt_url ? "Yes" : "No"}`,
    );
  }

  return lines.join("\n");
}

// ── System Prompt ─────────────────────────────────────────────

function buildSystemPrompt(action: string) {
  return `You are an expert Irish Chartered Accountant and Tax Advisor acting as a co-pilot for a practicing accountant reviewing a client's filing.

Your role is to analyse the client's financial data and produce actionable suggestions. You observe patterns, flag issues, and recommend optimisations — all grounded in Irish tax law.

## What You Know
- Irish Corporation Tax: 12.5% trading, 25% non-trading, close company surcharge (s.440 TCA)
- Capital Allowances: Plant 12.5% over 8 years, cars capped at €24k, vans full cost, energy-efficient 100% Year 1
- VAT: 23% standard, 13.5% reduced (construction/repairs), 9% second reduced, 4.8% livestock, 0% zero-rated
- VAT Input Credits: Food/drink NOT deductible (s.60(2)(a)(i)), entertainment NOT deductible (s.60(2)(a)(iii)), passenger vehicles NOT deductible (s.60(2)(a)(iv)), petrol NOT deductible but diesel IS (s.60(2)(a)(v))
- Two-thirds rule: If materials ≥ 2/3 of total repair cost → 23%, else 13.5%
- R&D Tax Credit: 35% of qualifying expenditure (from 2026)
- KDB: 10% CT on qualifying IP income
- Start-up Relief: First 3 years, max €40k/year offset against employer PRSI paid
- Pension: Employer contributions unlimited, 100% deductible, no BIK — most tax-efficient extraction
- Small Benefit Exemption: €1,500/year per employee/director (voucher only)
- SURE: Refund of prior 6 years PAYE, up to investment amount
- Entrepreneur Relief: 10% CGT (vs 33%), €1M lifetime
- RCT: Construction subcontractors 0%/20%/35%
- Mileage: Civil service rates, tiered by engine size and distance
- Medical relief: 20% of qualifying expenses (s.469)
- Rent credit: €1,000 single / €2,000 married (s.473B)
- Remote working: 30% of vouched heat/electric/broadband (s.114A)

## Your Corrections Intelligence
You have access to this accountant's prior corrections for this client AND patterns from other clients in the same industry. Use these to:
- Flag transactions that match vendor patterns the accountant has previously corrected
- Suggest categories based on industry consensus
- Identify inconsistencies where similar transactions are categorised differently

## Output Format
Return a JSON array of suggestions. Each suggestion:
{
  "type": "miscategorisation" | "missing_relief" | "compliance_risk" | "optimisation" | "missing_receipt" | "inconsistency",
  "severity": "high" | "medium" | "low",
  "title": "Short title",
  "description": "What the issue is and why it matters",
  "legislation": "TCA section or Revenue reference if applicable",
  "action": "What the accountant should do",
  "estimated_impact": "€ amount if quantifiable, null otherwise",
  "affected_transactions": ["transaction descriptions that are affected"] // optional
}

## Rules
- Be specific and actionable — don't give vague advice
- Always cite legislation (TCA section, Revenue guidance) when relevant
- Focus on material issues first (by € impact)
- If you see a pattern the accountant already corrected, flag remaining uncorrected instances
- Flag entertainment/food incorrectly claimed as business expenses
- Flag personal expenses in business accounts
- Flag capital items (>€1,000) categorised as revenue expenses
- Check VAT rates are correct for the industry
- Look for missed reliefs based on client profile and industry
- Don't flag things the accountant has already corrected
- Return ONLY the JSON array, no preamble or markdown

${action === "check_categorization" ? "Focus specifically on miscategorised transactions and VAT rate errors." : ""}
${action === "suggest_reliefs" ? "Focus specifically on missed reliefs, deductions, and tax optimisation opportunities." : ""}
${action === "review_filing" ? "Provide a comprehensive review covering categorisation, reliefs, compliance risks, and optimisations." : ""}`;
}

// ── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify accountant auth
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { client_user_id, filing_type, tax_year, action = "review_filing" } = body;

    if (!client_user_id || !filing_type || !tax_year) {
      return new Response(
        JSON.stringify({ error: "client_user_id, filing_type, and tax_year required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify accountant has access and copilot is enabled
    const { data: link } = await supabase
      .from("accountant_clients")
      .select("id, copilot_enabled")
      .eq("accountant_id", user.id)
      .eq("client_user_id", client_user_id)
      .eq("status", "active")
      .maybeSingle();

    if (!link) {
      return new Response(
        JSON.stringify({ error: "You don't have access to this client" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!link.copilot_enabled) {
      return new Response(
        JSON.stringify({ error: "Co-pilot is not enabled for this client" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Assemble context
    console.log(`[CoPilot] Assembling context for ${client_user_id} (${filing_type} ${tax_year})`);
    const context = await assembleClientContext(client_user_id, filing_type, tax_year);

    // Call LLM
    const systemPrompt = buildSystemPrompt(action);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[CoPilot] LLM error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to generate suggestions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const llmResult = await response.json();
    const content = llmResult.choices?.[0]?.message?.content || "[]";

    // Parse suggestions — handle markdown fences
    let suggestions: unknown[];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      console.error("[CoPilot] Failed to parse LLM response:", content);
      suggestions = [];
    }

    console.log(`[CoPilot] Generated ${suggestions.length} suggestions for ${client_user_id}`);

    return new Response(
      JSON.stringify({ ok: true, suggestions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[CoPilot] Error:", error);
    return new Response(
      JSON.stringify({ error: `Co-pilot failed: ${(error as Error).message || error}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
