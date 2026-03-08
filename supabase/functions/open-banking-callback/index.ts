/**
 * Open Banking Callback — handles the redirect after bank authentication.
 *
 * POST { code: "<auth_code>", state: "<state>" }
 * Creates an Enable Banking session, stores linked accounts, triggers initial sync.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLE_BANKING_APP_ID = Deno.env.get("ENABLE_BANKING_APP_ID") || "";
const ENABLE_BANKING_PRIVATE_KEY_B64 = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY") || "";
const API_BASE = "https://api.enablebanking.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user auth
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { code, state } = body;

    if (!code || !state) {
      return new Response(JSON.stringify({ error: "code and state required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify state matches a pending connection for this user
    const { data: connection, error: connError } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("state", state)
      .eq("status", "pending")
      .maybeSingle();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Invalid or expired state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = await generateJWT();

    // Create session with Enable Banking
    const sessionResponse = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!sessionResponse.ok) {
      const errText = await sessionResponse.text();
      console.error("[OpenBanking] Session creation failed:", sessionResponse.status, errText);

      await supabase
        .from("bank_connections")
        .update({ status: "failed", error_detail: errText })
        .eq("id", connection.id);

      return new Response(JSON.stringify({ error: "Failed to create bank session" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionData = await sessionResponse.json();
    const { session_id, accounts } = sessionData;

    // Update connection with session info
    await supabase
      .from("bank_connections")
      .update({
        session_id,
        status: "active",
        accounts: accounts || [],
        connected_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    // For each account, fetch details and store
    const accountDetails = [];
    for (const accountUid of (accounts || [])) {
      try {
        const detailRes = await fetch(`${API_BASE}/accounts/${accountUid}/details`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (detailRes.ok) {
          const detail = await detailRes.json();
          accountDetails.push({
            account_uid: accountUid,
            iban: detail.iban || null,
            name: detail.name || detail.product || connection.bank_name,
            currency: detail.currency || "EUR",
            account_type: detail.cash_account_type || "CACC",
          });
        }
      } catch (e) {
        console.error(`[OpenBanking] Failed to fetch details for account ${accountUid}:`, e);
        accountDetails.push({ account_uid: accountUid, name: connection.bank_name });
      }
    }

    // Update with account details
    await supabase
      .from("bank_connections")
      .update({ account_details: accountDetails })
      .eq("id", connection.id);

    console.log(
      `[OpenBanking] User ${user.id} connected ${connection.bank_name} with ${accounts?.length || 0} accounts`,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        bank: connection.bank_name,
        accounts: accountDetails,
        session_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[OpenBanking] Callback error:", error);
    return new Response(JSON.stringify({ error: "Bank connection failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
