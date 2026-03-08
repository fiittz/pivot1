/**
 * Open Banking Auth — starts Enable Banking authorization flow.
 *
 * POST { institution_name: "AIB", country: "IE" }
 * Returns { auth_url } — redirect the user there to authenticate with their bank.
 *
 * Requires: ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY (PEM, base64-encoded)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENABLE_BANKING_APP_ID = Deno.env.get("ENABLE_BANKING_APP_ID") || "";
const ENABLE_BANKING_PRIVATE_KEY_B64 = Deno.env.get("ENABLE_BANKING_PRIVATE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://app.balnce.ie";
const API_BASE = "https://api.enablebanking.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Generate a signed JWT for Enable Banking API authentication */
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

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import private key
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

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, encoder.encode(signingInput));
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
    const { institution_name, country } = body;

    if (!institution_name || !country) {
      return new Response(JSON.stringify({ error: "institution_name and country required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ENABLE_BANKING_APP_ID || !ENABLE_BANKING_PRIVATE_KEY_B64) {
      return new Response(JSON.stringify({ error: "Open banking not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = await generateJWT();

    // Calculate 90-day validity
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 90);

    // Generate a unique state for CSRF protection
    const state = crypto.randomUUID();

    // Store pending connection
    await supabase.from("bank_connections").insert({
      user_id: user.id,
      bank_name: institution_name,
      country,
      state,
      status: "pending",
      expires_at: validUntil.toISOString(),
    });

    // Start authorization with Enable Banking
    const authResponse = await fetch(`${API_BASE}/auth`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
        "Psu-Ip-Address": req.headers.get("x-forwarded-for") || "127.0.0.1",
        "Psu-User-Agent": req.headers.get("user-agent") || "Balnce/2.0",
      },
      body: JSON.stringify({
        access: { valid_until: validUntil.toISOString().split("T")[0] },
        aspsp: { name: institution_name, country },
        state,
        redirect_url: `${SITE_URL}/bank`,
        psu_type: "personal",
      }),
    });

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      console.error("[OpenBanking] Auth failed:", authResponse.status, errText);
      return new Response(JSON.stringify({ error: "Bank authorization failed", detail: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authData = await authResponse.json();

    return new Response(
      JSON.stringify({ auth_url: authData.url, state }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[OpenBanking] Error:", error);
    return new Response(JSON.stringify({ error: "Open banking auth failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
