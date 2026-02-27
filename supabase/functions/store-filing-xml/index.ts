import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { filing_id, xml_content, filename } = body;

    if (!filing_id || !xml_content || !filename) {
      return new Response(
        JSON.stringify({ error: "filing_id, xml_content, and filename are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the accountant owns this filing
    const { data: filing, error: filingError } = await supabase
      .from("filing_records")
      .select("id, accountant_id, accountant_client_id, status")
      .eq("id", filing_id)
      .maybeSingle();

    if (filingError || !filing) {
      return new Response(
        JSON.stringify({ error: "Filing not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (filing.accountant_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to modify this filing" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Store XML in Supabase Storage (filing-xml bucket)
    const storagePath = `${user.id}/${filing_id}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("filing-xml")
      .upload(storagePath, xml_content, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to store XML file" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get public URL for the stored file
    const { data: urlData } = supabase.storage
      .from("filing-xml")
      .getPublicUrl(storagePath);

    const xmlFileUrl = urlData?.publicUrl || storagePath;

    // Update filing record with XML metadata
    const { error: updateError } = await supabase
      .from("filing_records")
      .update({
        xml_file_url: xmlFileUrl,
        xml_generated_at: new Date().toISOString(),
      })
      .eq("id", filing_id);

    if (updateError) {
      console.error("Filing update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update filing record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        xml_file_url: xmlFileUrl,
        message: "XML stored successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in store-filing-xml:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
