/**
 * Sync Bank Transactions — pulls new transactions from Enable Banking and imports them.
 *
 * POST { connection_id } — sync specific connection
 * POST { user_id } — sync all active connections for user
 * POST {} with CRON_SECRET — sync all active connections (scheduled)
 *
 * For each transaction:
 *   1. Maps Enable Banking format → Balnce transaction format
 *   2. Uses MCC code for instant category suggestion (via mccCodes mapping)
 *   3. Deduplicates by bank transaction ID
 *   4. Triggers Magic Match nudge for expenses without receipts
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLE_BANKING_APP_ID = Deno.env.get("ENABLE_BANKING_APP_ID") || "";
const ENABLE_BANKING_PRIVATE_KEY_B64 = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY") || "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const API_BASE = "https://api.enablebanking.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── MCC code → category mapping (mirrors mccCodes.ts for edge function context) ──
// We store a simplified lookup; the full mapping lives client-side.
// For the edge function, we use the most common MCC → category mappings.
const MCC_CATEGORY_MAP: Record<number, { category: string; vat_type: string; description: string }> = {
  // Motor & Travel
  5541: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Service Station (Fuel)" },
  5542: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Automated Fuel Dispensers" },
  5983: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Fuel Dealers" },
  7523: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Parking" },
  7512: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Car Rental" },
  4121: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Taxi/Limousine" },
  4111: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Local Transport" },
  4112: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Railways" },
  4131: { category: "Motor & Travel", vat_type: "Standard 23%", description: "Bus Lines" },
  // Travel & Subsistence
  3000: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Airlines" },
  4511: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Airlines" },
  7011: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Hotels/Motels" },
  7012: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Timeshares" },
  5812: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Restaurants" },
  5813: { category: "Travel & Subsistence", vat_type: "Exempt", description: "Bars/Pubs" },
  5814: { category: "Travel & Subsistence", vat_type: "Standard 23%", description: "Fast Food" },
  // Office & Admin
  5111: { category: "Office & Admin", vat_type: "Standard 23%", description: "Stationery/Office Supplies" },
  5943: { category: "Office & Admin", vat_type: "Standard 23%", description: "Stationery Stores" },
  5734: { category: "Office & Admin", vat_type: "Standard 23%", description: "Computer Software" },
  5045: { category: "Office & Admin", vat_type: "Standard 23%", description: "Computers/Peripherals" },
  // Telephone & Internet
  4812: { category: "Telephone & Internet", vat_type: "Standard 23%", description: "Telecom Equipment" },
  4814: { category: "Telephone & Internet", vat_type: "Standard 23%", description: "Telecom Services" },
  4816: { category: "Telephone & Internet", vat_type: "Standard 23%", description: "Computer Network Services" },
  // Professional Fees
  8111: { category: "Professional Fees", vat_type: "Standard 23%", description: "Legal Services" },
  8931: { category: "Professional Fees", vat_type: "Standard 23%", description: "Accounting/Bookkeeping" },
  8999: { category: "Professional Fees", vat_type: "Standard 23%", description: "Professional Services" },
  // Insurance
  6300: { category: "Insurance", vat_type: "Exempt", description: "Insurance" },
  5960: { category: "Insurance", vat_type: "Exempt", description: "Insurance Sales" },
  // Utilities
  4900: { category: "Light, Heat & Power", vat_type: "Reduced 13.5%", description: "Utilities" },
  // Materials / Trade
  5211: { category: "Materials", vat_type: "Standard 23%", description: "Building Materials/Hardware" },
  5231: { category: "Materials", vat_type: "Standard 23%", description: "Glass/Paint/Wallpaper" },
  5251: { category: "Materials", vat_type: "Standard 23%", description: "Hardware Stores" },
  1520: { category: "Materials", vat_type: "Standard 23%", description: "General Contractors" },
  1711: { category: "Materials", vat_type: "Standard 23%", description: "Heating/Plumbing Contractors" },
  1731: { category: "Materials", vat_type: "Standard 23%", description: "Electrical Contractors" },
  1740: { category: "Materials", vat_type: "Standard 23%", description: "Masonry/Stonework" },
  1750: { category: "Materials", vat_type: "Standard 23%", description: "Carpentry" },
  // Repairs & Maintenance
  7538: { category: "Repairs & Maintenance", vat_type: "Standard 23%", description: "Auto Service Shops" },
  7542: { category: "Repairs & Maintenance", vat_type: "Standard 23%", description: "Car Washes" },
  // Advertising & Marketing
  7311: { category: "Advertising & Marketing", vat_type: "Standard 23%", description: "Advertising Services" },
  7333: { category: "Advertising & Marketing", vat_type: "Standard 23%", description: "Commercial Photography" },
  // Subscriptions
  4899: { category: "Subscriptions", vat_type: "Standard 23%", description: "Cable/Streaming Services" },
  5815: { category: "Subscriptions", vat_type: "Standard 23%", description: "Digital Goods" },
  5816: { category: "Subscriptions", vat_type: "Standard 23%", description: "Digital Games" },
  5817: { category: "Subscriptions", vat_type: "Standard 23%", description: "Software (SaaS)" },
  5818: { category: "Subscriptions", vat_type: "Standard 23%", description: "Digital Services" },
  // Bank & Finance
  6010: { category: "Bank Charges", vat_type: "Exempt", description: "Financial Institutions" },
  6011: { category: "Bank Charges", vat_type: "Exempt", description: "ATM" },
  6012: { category: "Bank Charges", vat_type: "Exempt", description: "Financial Institutions" },
  6051: { category: "Bank Charges", vat_type: "Exempt", description: "Non-FI Forex" },
};

async function generateJWT(): Promise<string> {
  const privateKeyPem = atob(ENABLE_BANKING_PRIVATE_KEY_B64);
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: "JWT", alg: "RS256", kid: ENABLE_BANKING_APP_ID };
  const payload = {
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat: now,
    exp: now + 3600,
  };

  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string;
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator?: string;
  status?: string;
  creditor?: { name?: string };
  debtor?: { name?: string };
  remittance_information?: string[];
  merchant_category_code?: string;
  bank_transaction_code?: { code?: string; description?: string; sub_code?: string };
  end_to_end_id?: string;
}

function mapTransaction(
  tx: EnableBankingTransaction,
  userId: string,
  accountId: string | null,
  connectionId: string,
) {
  const amount = parseFloat(tx.transaction_amount.amount);
  const isExpense = tx.credit_debit_indicator === "DBIT" || amount < 0;
  const absAmount = Math.abs(amount);
  const date = tx.booking_date || tx.value_date || tx.transaction_date || new Date().toISOString().split("T")[0];

  // Build description from available fields
  const merchantName = isExpense ? (tx.creditor?.name || "") : (tx.debtor?.name || "");
  const remittance = (tx.remittance_information || []).join(" ").trim();
  const description = merchantName || remittance || "Bank transaction";

  // MCC-based category suggestion
  const mccCode = tx.merchant_category_code ? parseInt(tx.merchant_category_code, 10) : null;
  const mccMapping = mccCode ? MCC_CATEGORY_MAP[mccCode] : null;

  // Build notes with source metadata
  const noteParts: string[] = ["[Open Banking]"];
  if (mccMapping) {
    noteParts.push(`[MCC:${mccCode} ${mccMapping.description}]`);
  }
  if (remittance && merchantName) {
    noteParts.push(remittance);
  }

  return {
    user_id: userId,
    transaction_date: date,
    description,
    amount: isExpense ? -absAmount : absAmount,
    type: isExpense ? "expense" : "income",
    is_reconciled: false,
    account_id: accountId,
    reference: tx.transaction_id || tx.entry_reference || tx.end_to_end_id || null,
    notes: noteParts.join(" "),
    bank_transaction_id: tx.transaction_id || tx.entry_reference || null,
    bank_connection_id: connectionId,
    mcc_code: mccCode,
    // Pre-fill category from MCC if available (will be confirmed/overridden by autocat + receipt)
    ...(mccMapping
      ? {
          ai_category: mccMapping.category,
          ai_confidence: 0.85,
          ai_explanation: `Auto-categorised via MCC ${mccCode} (${mccMapping.description})`,
        }
      : {}),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let connections: Array<Record<string, unknown>> = [];

    // Auth: either user token or cron secret
    const authHeader = req.headers.get("authorization") ?? "";
    const cronSecret = new URL(req.url).searchParams.get("secret");

    if (cronSecret === CRON_SECRET && CRON_SECRET) {
      // Cron mode — sync all active connections
      const { data } = await supabase
        .from("bank_connections")
        .select("*")
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());

      connections = data || [];
    } else {
      // User mode
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.connection_id) {
        const { data } = await supabase
          .from("bank_connections")
          .select("*")
          .eq("id", body.connection_id)
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();
        if (data) connections = [data];
      } else {
        const { data } = await supabase
          .from("bank_connections")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active");
        connections = data || [];
      }
    }

    if (connections.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, synced: 0, message: "No active connections" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = await generateJWT();
    let totalImported = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      const accountUids = (conn.accounts as string[]) || [];
      const userId = conn.user_id as string;
      const connectionId = conn.id as string;

      // Get the user's default financial account (for account_id assignment)
      const { data: financialAccounts } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      const defaultAccountId = financialAccounts?.[0]?.id || null;

      // Calculate date range: last sync or last 30 days
      const lastSync = conn.last_synced_at as string | null;
      const dateFrom = lastSync
        ? new Date(lastSync).toISOString().split("T")[0]
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            return d.toISOString().split("T")[0];
          })();
      const dateTo = new Date().toISOString().split("T")[0];

      for (const accountUid of accountUids) {
        try {
          // Fetch transactions from Enable Banking
          let continuationKey: string | null = null;
          let allTransactions: EnableBankingTransaction[] = [];

          do {
            const url = new URL(`${API_BASE}/accounts/${accountUid}/transactions`);
            url.searchParams.set("date_from", dateFrom);
            url.searchParams.set("date_to", dateTo);
            if (continuationKey) url.searchParams.set("continuation_key", continuationKey);

            const txnRes = await fetch(url.toString(), {
              headers: { Authorization: `Bearer ${jwt}` },
            });

            if (!txnRes.ok) {
              const errText = await txnRes.text();
              console.error(`[Sync] Failed for account ${accountUid}:`, txnRes.status, errText);
              errors.push(`Account ${accountUid}: ${txnRes.status}`);
              break;
            }

            const txnData = await txnRes.json();
            const booked = txnData.transactions?.booked || txnData.booked || [];
            allTransactions = allTransactions.concat(booked);
            continuationKey = txnData.continuation_key || null;
          } while (continuationKey);

          if (allTransactions.length === 0) continue;

          // Get existing bank_transaction_ids for deduplication
          const bankTxnIds = allTransactions
            .map((t) => t.transaction_id || t.entry_reference)
            .filter(Boolean) as string[];

          const { data: existing } = await supabase
            .from("transactions")
            .select("bank_transaction_id")
            .eq("user_id", userId)
            .in("bank_transaction_id", bankTxnIds.slice(0, 500));

          const existingIds = new Set((existing || []).map((e) => e.bank_transaction_id));

          // Map and filter new transactions
          const newTransactions = allTransactions
            .filter((t) => {
              const id = t.transaction_id || t.entry_reference;
              return id && !existingIds.has(id);
            })
            .filter((t) => t.status === "BOOK" || t.status === undefined) // Only booked transactions
            .map((t) => mapTransaction(t, userId, defaultAccountId, connectionId));

          if (newTransactions.length === 0) {
            totalSkipped += allTransactions.length;
            continue;
          }

          // Insert in chunks
          const CHUNK = 50;
          const insertedIds: string[] = [];
          for (let i = 0; i < newTransactions.length; i += CHUNK) {
            const chunk = newTransactions.slice(i, i + CHUNK);
            const { data, error } = await supabase
              .from("transactions")
              .insert(chunk)
              .select("id");

            if (error) {
              console.error(`[Sync] Insert error:`, error);
              errors.push(`Insert: ${error.message}`);
            } else if (data) {
              insertedIds.push(...data.map((d) => d.id));
            }
          }

          totalImported += insertedIds.length;
          totalSkipped += allTransactions.length - newTransactions.length;

          // Trigger Magic Match for new expense transactions (fire-and-forget)
          if (insertedIds.length > 0) {
            supabase.functions.invoke("magic-match-nudge", {
              body: { user_id: userId, transaction_ids: insertedIds },
            }).catch((e) => console.error("[Sync] Magic match error:", e));
          }
        } catch (e) {
          console.error(`[Sync] Error syncing account ${accountUid}:`, e);
          errors.push(`Account ${accountUid}: ${String(e)}`);
        }
      }

      // Update last sync timestamp
      await supabase
        .from("bank_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", connectionId);
    }

    console.log(`[Sync] Imported ${totalImported}, skipped ${totalSkipped}, errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        ok: true,
        imported: totalImported,
        skipped: totalSkipped,
        connections: connections.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Sync] Error:", error);
    return new Response(JSON.stringify({ error: "Bank sync failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
