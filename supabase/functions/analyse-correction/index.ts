/**
 * Analyse Correction — diagnostic agent that figures out WHY a categorisation was wrong.
 *
 * Called fire-and-forget after an accountant recategorises a transaction.
 * Uses tools (web search, receipt check, onboarding cross-reference) to determine
 * root cause, then stores the analysis on the correction record.
 *
 * POST { correction_id, vendor_pattern, transaction_description, original_category,
 *        corrected_category, client_user_id, transaction_amount, original_vat_rate,
 *        corrected_vat_rate }
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

// ── Tool Implementations ──────────────────────────────────────

async function webSearchVendor(vendorPattern: string): Promise<string> {
  // Use a simple search to determine what the vendor does
  try {
    const query = `${vendorPattern} Ireland what do they sell business`;
    const response = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; BalnceBot/1.0)",
        },
      },
    );
    if (!response.ok) {
      return `Could not search for "${vendorPattern}" — search returned ${response.status}`;
    }
    const html = await response.text();
    // Extract text snippets (rough extraction from search results)
    const snippets = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 3000);
    return `Web search results for "${vendorPattern}":\n${snippets}`;
  } catch (err) {
    return `Web search failed for "${vendorPattern}": ${err}`;
  }
}

async function reExamineReceipt(
  clientUserId: string,
  transactionDescription: string,
): Promise<string> {
  // Find matching transaction and check receipt data
  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, description, amount, date, category, receipt_url, vendor, vat_rate")
    .eq("user_id", clientUserId)
    .ilike("description", `%${transactionDescription.slice(0, 30)}%`)
    .limit(3);

  if (!transactions || transactions.length === 0) {
    return "No matching transaction found for receipt examination.";
  }

  const results: string[] = [];
  for (const txn of transactions) {
    if (!txn.receipt_url) {
      results.push(
        `Transaction "${txn.description}" (€${Math.abs(txn.amount).toFixed(2)}) — NO RECEIPT ATTACHED`,
      );
      continue;
    }

    // Check if there's OCR data in receipts table
    const { data: receipt } = await supabase
      .from("receipts")
      .select("ocr_text, vendor_name, total_amount, vat_amount, line_items")
      .eq("file_url", txn.receipt_url)
      .maybeSingle();

    if (receipt) {
      results.push(
        `Transaction "${txn.description}" (€${Math.abs(txn.amount).toFixed(2)}):\n` +
          `  Receipt vendor: ${receipt.vendor_name || "Unknown"}\n` +
          `  Receipt total: €${receipt.total_amount || "?"}\n` +
          `  Receipt VAT: €${receipt.vat_amount || "?"}\n` +
          `  Line items: ${JSON.stringify(receipt.line_items || [])}\n` +
          `  OCR text: ${(receipt.ocr_text || "").slice(0, 500)}`,
      );
    } else {
      results.push(
        `Transaction "${txn.description}" (€${Math.abs(txn.amount).toFixed(2)}) — receipt URL exists but no OCR data extracted`,
      );
    }
  }

  return results.join("\n\n");
}

async function crossReferenceOnboarding(clientUserId: string): Promise<string> {
  const { data: onboarding } = await supabase
    .from("onboarding_settings")
    .select("*")
    .eq("user_id", clientUserId)
    .single();

  if (!onboarding) return "No onboarding data found for this client.";

  const lines = [
    `Client Profile:`,
    `  Business name: ${onboarding.company_name || "?"}`,
    `  Business type: ${onboarding.business_type || "?"}`,
    `  Industry: ${(onboarding as any).industry || onboarding.business_type || "?"}`,
    `  Primary activity: ${(onboarding as any).primary_activity || "?"}`,
    `  VAT registered: ${onboarding.vat_registered ? "Yes" : "No"}`,
    `  RCT registered: ${onboarding.rct_registered ? "Yes" : "No"}`,
    `  Employees: ${(onboarding as any).employee_count || "?"}`,
    `  Home office: ${(onboarding as any).home_office_percentage || 0}%`,
  ];

  return lines.join("\n");
}

async function checkPriorCorrections(vendorPattern: string): Promise<string> {
  const { data: corrections } = await supabase
    .from("accountant_corrections")
    .select(
      "vendor_pattern, original_category, corrected_category, corrected_vat_rate, correction_count, client_industry, analysis",
    )
    .eq("vendor_pattern", vendorPattern)
    .order("correction_count", { ascending: false })
    .limit(10);

  if (!corrections || corrections.length === 0) {
    return `No prior corrections found for vendor pattern "${vendorPattern}".`;
  }

  const lines = [`Prior corrections for "${vendorPattern}":`];
  for (const c of corrections) {
    lines.push(
      `  ${c.original_category || "?"} → ${c.corrected_category} (×${c.correction_count}, industry: ${c.client_industry || "?"})` +
        (c.analysis
          ? ` [Prior analysis: ${(c.analysis as any).root_cause || "none"}]`
          : ""),
    );
  }

  return lines.join("\n");
}

function checkVatRules(
  correctedCategory: string,
  originalVatRate: number | null,
  correctedVatRate: number | null,
): string {
  const lines = [`VAT Rules Check for category "${correctedCategory}":`];

  // Non-deductible categories per S.60(2) TCA
  const nonDeductible = [
    "Entertainment",
    "Food & Drink",
    "Meals",
    "Client Entertainment",
    "Staff Entertainment",
    "Accommodation",
    "Hotels",
  ];
  const isNonDeductible = nonDeductible.some((nd) =>
    correctedCategory.toLowerCase().includes(nd.toLowerCase()),
  );

  if (isNonDeductible) {
    lines.push(
      `  ⚠ "${correctedCategory}" — VAT input credit NOT recoverable per S.60(2)(a)(i)/(iii) TCA 1997`,
    );
    lines.push(`  Food, drink, entertainment, and accommodation VAT is blocked.`);
    if (correctedCategory.toLowerCase().includes("staff")) {
      lines.push(
        `  EXCEPTION: Staff events (Christmas party, team outing) may be deductible if for all staff.`,
      );
    }
  }

  if (correctedCategory.toLowerCase().includes("petrol")) {
    lines.push(`  ⚠ Petrol — VAT NOT recoverable per S.60(2)(a)(v). Diesel IS recoverable.`);
  }

  if (correctedCategory.toLowerCase().includes("vehicle") || correctedCategory.toLowerCase().includes("car")) {
    lines.push(
      `  ⚠ Passenger motor vehicles — VAT NOT recoverable per S.60(2)(a)(iv). Vans and commercial vehicles ARE.`,
    );
  }

  // Construction two-thirds rule
  if (
    correctedCategory.toLowerCase().includes("repair") ||
    correctedCategory.toLowerCase().includes("maintenance")
  ) {
    lines.push(
      `  ℹ Two-thirds rule may apply: if materials ≥ 2/3 of total → 23%, else 13.5% (construction repairs).`,
    );
  }

  if (originalVatRate !== correctedVatRate) {
    lines.push(
      `  VAT rate changed: ${originalVatRate ?? "null"}% → ${correctedVatRate ?? "null"}%`,
    );
  }

  if (lines.length === 1) {
    lines.push(`  No specific VAT issues identified.`);
  }

  return lines.join("\n");
}

function checkAmountThreshold(amount: number | null, correctedCategory: string): string {
  if (!amount) return "Amount not available for threshold check.";

  const absAmount = Math.abs(amount);
  const lines = [`Amount Check: €${absAmount.toFixed(2)}`];

  if (absAmount >= 1000) {
    lines.push(
      `  ⚠ Amount ≥ €1,000 — may be a capital item. Should this be capitalised and claimed via capital allowances (12.5% over 8 years) rather than expensed immediately?`,
    );
    if (
      correctedCategory.toLowerCase().includes("equipment") ||
      correctedCategory.toLowerCase().includes("plant") ||
      correctedCategory.toLowerCase().includes("machinery") ||
      correctedCategory.toLowerCase().includes("vehicle") ||
      correctedCategory.toLowerCase().includes("computer")
    ) {
      lines.push(`  Category "${correctedCategory}" suggests this IS a capital item — correct treatment.`);
    }
  }

  if (absAmount < 5 && correctedCategory.toLowerCase().includes("entertainment")) {
    lines.push(`  Small amount (€${absAmount.toFixed(2)}) categorised as entertainment — likely a coffee/snack, probably correct.`);
  }

  return lines.join("\n");
}

// ── Knowledge Gap Detection ───────────────────────────────────

/**
 * When the agent encounters a category or rule that doesn't exist in the app's
 * knowledge base, it stores it as a "learned rule" in the knowledge_gaps table.
 * This grows the system's tax knowledge over time from accountant behaviour.
 */
async function recordKnowledgeGap(gap: {
  category: string;
  rule_description: string;
  legislation_ref: string | null;
  vat_treatment: string | null;
  source_vendor: string;
  source_correction_id: string | null;
}): Promise<void> {
  try {
    await supabase.from("copilot_learned_rules").upsert(
      {
        category: gap.category,
        rule_description: gap.rule_description,
        legislation_ref: gap.legislation_ref,
        vat_treatment: gap.vat_treatment,
        source_vendor: gap.source_vendor,
        source_correction_id: gap.source_correction_id,
        verified: false,
        occurrence_count: 1,
      },
      { onConflict: "category,source_vendor" },
    );
    console.log(`[AnalyseCorrection] Learned new rule: "${gap.category}" — ${gap.rule_description}`);
  } catch (err) {
    console.error("[AnalyseCorrection] Failed to record knowledge gap:", err);
  }
}

// ── LLM Analysis ──────────────────────────────────────────────

async function runAnalysis(
  toolResults: Record<string, string>,
  vendorPattern: string,
  originalCategory: string | null,
  correctedCategory: string,
  transactionDescription: string,
  amount: number | null,
): Promise<Record<string, unknown>> {
  const systemPrompt = `You are a diagnostic agent inside an Irish accounting system. An accountant just corrected a transaction categorisation. Your job is to figure out WHY the system got it wrong, so it doesn't happen again.

You have been given the results of these diagnostic checks:
1. Web search for the vendor
2. Receipt/OCR re-examination
3. Client business profile cross-reference
4. Prior corrections for this vendor
5. Irish VAT rules validation
6. Amount threshold check

Based on ALL of this evidence, determine:
- root_cause: One of: "vendor_misidentified" | "industry_mismatch" | "amount_based_rule" | "vat_rule_violation" | "personal_expense" | "capital_vs_revenue" | "insufficient_data" | "edge_case"
- explanation: 1-2 sentences explaining why the original categorisation was wrong and why the correction is right. Cite specific Irish tax legislation where relevant.
- pattern_rule: A concise rule like "Deliveroo|UberEats → Entertainment" that can be applied to future transactions
- applies_globally: true if this rule applies to ALL clients (e.g. "Deliveroo is always food"), false if it's client/industry-specific
- vat_impact: Brief note on VAT implications, or null if none
- confidence: 0-100 how confident you are in this analysis
- new_knowledge: If the corrected category or tax treatment involves a rule NOT commonly known (e.g. "staff night out", "subsistence vs entertainment", "two-thirds rule application", "BIK on company vehicle"), include an object: { "category": "Staff Entertainment", "rule_description": "Staff night out for all employees is a deductible business expense...", "legislation_ref": "s.81 TCA 1997", "vat_treatment": "VAT not recoverable per S.60(2)(a)(iii) unless staff event" }. Set to null if no new knowledge needed.

Return ONLY a JSON object with these fields, no markdown fences.`;

  const userContent = `Correction Details:
- Vendor: "${vendorPattern}"
- Transaction: "${transactionDescription}"
- Amount: €${amount ? Math.abs(amount).toFixed(2) : "unknown"}
- Changed from: "${originalCategory || "Uncategorised"}" → "${correctedCategory}"

--- Tool Results ---

${Object.entries(toolResults)
    .map(([tool, result]) => `### ${tool}\n${result}`)
    .join("\n\n")}`;

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
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";

  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      root_cause: "insufficient_data",
      explanation: "Could not parse analysis result.",
      pattern_rule: `${vendorPattern} → ${correctedCategory}`,
      applies_globally: false,
      vat_impact: null,
      confidence: 30,
    };
  }
}

// ── Main Handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      correction_id,
      vendor_pattern,
      transaction_description,
      original_category,
      corrected_category,
      client_user_id,
      transaction_amount,
      original_vat_rate,
      corrected_vat_rate,
    } = body;

    if (!vendor_pattern || !corrected_category || !client_user_id) {
      return new Response(
        JSON.stringify({ error: "vendor_pattern, corrected_category, and client_user_id required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[AnalyseCorrection] Starting analysis for "${vendor_pattern}" (${original_category} → ${corrected_category})`);

    // Check if this vendor is already in the vendor database (known vendor)
    // If so, we can skip the web search
    const { data: existingVendor } = await supabase
      .from("vendor_cache")
      .select("vendor_pattern, category, source, confidence")
      .eq("vendor_pattern", vendor_pattern)
      .is("user_id", null) // Global cache only
      .maybeSingle();

    // Run all tool checks in parallel
    const [webResult, receiptResult, onboardingResult, priorResult] = await Promise.all([
      existingVendor
        ? Promise.resolve(
            `Known vendor "${vendor_pattern}": Currently categorised as "${existingVendor.category}" (source: ${existingVendor.source}, confidence: ${existingVendor.confidence}). No web search needed.`,
          )
        : webSearchVendor(vendor_pattern),
      reExamineReceipt(client_user_id, transaction_description),
      crossReferenceOnboarding(client_user_id),
      checkPriorCorrections(vendor_pattern),
    ]);

    // These are deterministic — no async needed
    const vatResult = checkVatRules(corrected_category, original_vat_rate, corrected_vat_rate);
    const amountResult = checkAmountThreshold(transaction_amount, corrected_category);

    const toolResults = {
      "Web Search / Vendor Lookup": webResult,
      "Receipt Re-examination": receiptResult,
      "Client Profile Cross-reference": onboardingResult,
      "Prior Corrections History": priorResult,
      "VAT Rules Validation": vatResult,
      "Amount Threshold Check": amountResult,
    };

    // Run LLM analysis
    const analysis = await runAnalysis(
      toolResults,
      vendor_pattern,
      original_category,
      corrected_category,
      transaction_description,
      transaction_amount,
    );

    // Store analysis on the correction record
    if (correction_id) {
      await supabase
        .from("accountant_corrections")
        .update({ analysis })
        .eq("id", correction_id);
    } else {
      // Find and update by vendor pattern + client
      await supabase
        .from("accountant_corrections")
        .update({ analysis })
        .eq("vendor_pattern", vendor_pattern)
        .eq("client_user_id", client_user_id)
        .is("analysis", null);
    }

    // If the agent learned something new, store it
    if (analysis.new_knowledge && typeof analysis.new_knowledge === "object") {
      const nk = analysis.new_knowledge as Record<string, unknown>;
      await recordKnowledgeGap({
        category: (nk.category as string) || corrected_category,
        rule_description: (nk.rule_description as string) || (analysis.explanation as string) || "",
        legislation_ref: (nk.legislation_ref as string) || null,
        vat_treatment: (nk.vat_treatment as string) || null,
        source_vendor: vendor_pattern,
        source_correction_id: correction_id || null,
      });
    }

    // If analysis says applies_globally with high confidence, update the global vendor cache
    if (analysis.applies_globally && (analysis.confidence as number) >= 80) {
      await supabase.from("vendor_cache").upsert(
        {
          vendor_pattern,
          normalized_name: vendor_pattern,
          category: corrected_category,
          vat_type: corrected_vat_rate === 23 ? "Standard 23%" : corrected_vat_rate === 13.5 ? "Reduced 13.5%" : corrected_vat_rate === 0 ? "Zero" : "N/A",
          vat_deductible: corrected_vat_rate !== null && corrected_vat_rate > 0,
          business_purpose: (analysis.explanation as string) || "Accountant-verified.",
          confidence: Math.min((analysis.confidence as number) || 90, 98),
          source: "agent_analysis",
          user_id: null, // Global
          hit_count: 1,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "vendor_pattern,user_id" },
      );
      console.log(`[AnalyseCorrection] Promoted "${vendor_pattern}" to global cache (confidence: ${analysis.confidence})`);
    }

    console.log(
      `[AnalyseCorrection] Complete: "${vendor_pattern}" — root_cause: ${analysis.root_cause}, confidence: ${analysis.confidence}`,
    );

    return new Response(
      JSON.stringify({ ok: true, analysis }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[AnalyseCorrection] Error:", error);
    return new Response(
      JSON.stringify({ error: `Analysis failed: ${(error as Error).message || error}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
