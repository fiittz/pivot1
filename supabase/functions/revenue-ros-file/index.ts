import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

/**
 * Revenue ROS Filing Edge Function
 *
 * Submits tax returns (VAT3, CT1, Form 11) to Revenue via the ROS Web Service.
 * Uses the accountant's ROS digital certificate for authentication.
 *
 * Actions:
 *   - file_vat3:   Submit VAT3 return
 *   - file_ct1:    Submit CT1 Corporation Tax return
 *   - file_form11: Submit Form 11 Income Tax return
 *   - check_status: Check filing acknowledgement status
 *
 * All filings are stored in the revenue_filings table with full audit trail.
 */

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Revenue ROS Web Service endpoints
const ROS_ENDPOINTS = {
  test: "https://rospublictest.ros.ie/ros-web-service/",
  production: "https://ros.ie/ros-web-service/",
};

// ROS SOAP actions per return type
const SOAP_ACTIONS: Record<string, string> = {
  file_vat3: "SubmitVAT3",
  file_ct1: "SubmitCT1",
  file_form11: "SubmitForm11",
  check_status: "CheckFilingStatus",
};

// ---------------------------------------------------------------------------
// SOAP XML builders
// ---------------------------------------------------------------------------

function buildRosEnvelope(
  agentTain: string,
  agentTaxRef: string,
  clientTaxRef: string,
  rosCertSerial: string,
  bodyXml: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ros="http://www.ros.ie/schemas/ros-web-service">
  <soap:Header>
    <ros:Authentication>
      <ros:AgentTAIN>${agentTain}</ros:AgentTAIN>
      <ros:AgentTaxRegistrationNumber>${agentTaxRef}</ros:AgentTaxRegistrationNumber>
      <ros:ClientTaxRegistrationNumber>${clientTaxRef}</ros:ClientTaxRegistrationNumber>
      <ros:CertificateSerial>${rosCertSerial}</ros:CertificateSerial>
    </ros:Authentication>
  </soap:Header>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * Wrap a pre-generated XML return in the ROS submission body.
 * The returnXml is the full Revenue-schema XML (CT1/VAT3/Form11).
 */
function buildSubmissionBody(
  returnType: string,
  periodStart: string,
  periodEnd: string,
  returnXml: string
): string {
  return `<ros:ReturnSubmission>
      <ros:ReturnType>${returnType}</ros:ReturnType>
      <ros:PeriodStart>${periodStart}</ros:PeriodStart>
      <ros:PeriodEnd>${periodEnd}</ros:PeriodEnd>
      <ros:ReturnData><![CDATA[${returnXml}]]></ros:ReturnData>
    </ros:ReturnSubmission>`;
}

function buildStatusCheckBody(filingReference: string): string {
  return `<ros:FilingStatusRequest>
      <ros:FilingReference>${filingReference}</ros:FilingReference>
    </ros:FilingStatusRequest>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractXmlValue(xml: string, tagName: string): string | null {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[\\w-]+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractSoapFault(xml: string): string | null {
  const faultString = extractXmlValue(xml, "faultstring");
  if (faultString) return faultString;
  const faultDetail = extractXmlValue(xml, "detail");
  return faultDetail || null;
}

async function sendSoapRequest(
  endpoint: string,
  soapXml: string,
  soapAction: string
): Promise<{ status: number; body: string }> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    },
    body: soapXml,
  });

  const body = await response.text();
  return { status: response.status, body };
}

async function getAgentCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{
  tain: string;
  agent_name: string;
  tax_registration_number: string;
  ros_cert_serial: string | null;
  test_mode: boolean;
}> {
  const { data, error } = await supabase
    .from("accountant_revenue_credentials")
    .select(
      "tain, agent_name, tax_registration_number, ros_cert_serial, test_mode"
    )
    .eq("accountant_id", userId)
    .single();

  if (error || !data) {
    throw new Error(
      "Agent credentials not configured. Set up your TAIN and ROS certificate first."
    );
  }
  return data;
}

/**
 * Get client's tax registration number from accountant_clients.
 */
async function getClientTaxRef(
  supabase: ReturnType<typeof createClient>,
  clientUserId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("accountant_clients")
    .select("tax_reg_number")
    .eq("client_user_id", clientUserId)
    .single();

  if (error || !data?.tax_reg_number) {
    throw new Error(
      "Client tax registration number not set. Update the client's Revenue link first."
    );
  }
  return data.tax_reg_number;
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

type ReturnType = "VAT3" | "CT1" | "Form11";

async function handleFileReturn(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: {
    clientUserId: string;
    returnType: ReturnType;
    periodStart: string;
    periodEnd: string;
    returnXml: string;
    taxYear: number;
    summary?: Record<string, unknown>;
  }
): Promise<Response> {
  const { clientUserId, returnType, periodStart, periodEnd, returnXml, taxYear, summary } = params;

  // Validate
  if (!clientUserId || !returnType || !periodStart || !periodEnd || !returnXml) {
    return new Response(
      JSON.stringify({
        error: "clientUserId, returnType, periodStart, periodEnd, and returnXml are required.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!["VAT3", "CT1", "Form11"].includes(returnType)) {
    return new Response(
      JSON.stringify({ error: "returnType must be VAT3, CT1, or Form11." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get client's tax ref
  const clientTaxRef = await getClientTaxRef(supabase, clientUserId);

  if (!credentials.ros_cert_serial) {
    return new Response(
      JSON.stringify({
        error: "ROS certificate not configured. Upload your ROS digital certificate to file returns.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const endpoint = credentials.test_mode
    ? ROS_ENDPOINTS.test
    : ROS_ENDPOINTS.production;

  const actionKey = `file_${returnType.toLowerCase()}`;
  const soapAction = SOAP_ACTIONS[actionKey] || "SubmitReturn";

  // Build SOAP request
  const bodyXml = buildSubmissionBody(returnType, periodStart, periodEnd, returnXml);
  const soapXml = buildRosEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    clientTaxRef,
    credentials.ros_cert_serial,
    bodyXml
  );

  console.log(
    `[revenue-ros-file] ${returnType} for client=${clientUserId}, period=${periodStart}→${periodEnd}, test_mode=${credentials.test_mode}`
  );

  // Create filing record BEFORE submission (status: submitting)
  const { data: filing, error: filingError } = await supabase
    .from("revenue_filings")
    .insert({
      accountant_id: userId,
      client_user_id: clientUserId,
      return_type: returnType,
      tax_year: taxYear,
      period_start: periodStart,
      period_end: periodEnd,
      status: "submitting",
      return_xml: returnXml,
      summary_data: summary || null,
      test_mode: credentials.test_mode,
    })
    .select("id")
    .single();

  if (filingError) {
    console.error("[revenue-ros-file] Failed to create filing record:", filingError);
    throw filingError;
  }

  const filingId = filing.id;

  // Send to Revenue
  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    soapAction
  );

  // Store SOAP audit trail
  await supabase.from("erct_audit_log").insert({
    user_id: userId,
    action: actionKey,
    request_xml: soapXml,
    response_xml: responseXml,
    http_status: status,
    success: status === 200,
    referenced_entity_type: "revenue_filing",
    referenced_entity_id: filingId,
  });

  // Check for SOAP fault
  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    console.error(`[revenue-ros-file] ${returnType} SOAP fault: ${fault}`);

    // Update filing with error
    await supabase
      .from("revenue_filings")
      .update({
        status: "failed",
        error_message: fault || `HTTP ${status}`,
        response_xml: responseXml,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", filingId);

    return new Response(
      JSON.stringify({
        error: `${returnType} filing failed`,
        detail: fault || `HTTP ${status}`,
        filingId,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Parse Revenue acknowledgement
  const filingReference = extractXmlValue(responseXml, "FilingReference") ||
    extractXmlValue(responseXml, "AcknowledgementNumber") ||
    extractXmlValue(responseXml, "SubmissionReference") ||
    null;

  const revenueStatus = extractXmlValue(responseXml, "Status") || "accepted";

  // Update filing with success
  await supabase
    .from("revenue_filings")
    .update({
      status: revenueStatus === "accepted" ? "filed" : "pending",
      filing_reference: filingReference,
      revenue_status: revenueStatus,
      response_xml: responseXml,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", filingId);

  return new Response(
    JSON.stringify({
      filingId,
      returnType,
      filingReference,
      status: revenueStatus,
      periodStart,
      periodEnd,
      testMode: credentials.test_mode,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleCheckStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { filingId: string; clientUserId: string }
): Promise<Response> {
  const { filingId, clientUserId } = params;

  if (!filingId) {
    return new Response(
      JSON.stringify({ error: "filingId is required." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get the filing record
  const { data: filing, error: filingError } = await supabase
    .from("revenue_filings")
    .select("filing_reference, return_type, status")
    .eq("id", filingId)
    .eq("accountant_id", userId)
    .single();

  if (filingError || !filing) {
    return new Response(
      JSON.stringify({ error: "Filing not found." }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!filing.filing_reference) {
    return new Response(
      JSON.stringify({
        error: "No filing reference — return may not have been accepted by Revenue.",
        currentStatus: filing.status,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const clientTaxRef = await getClientTaxRef(supabase, clientUserId);

  const endpoint = credentials.test_mode
    ? ROS_ENDPOINTS.test
    : ROS_ENDPOINTS.production;

  const bodyXml = buildStatusCheckBody(filing.filing_reference);
  const soapXml = buildRosEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    clientTaxRef,
    credentials.ros_cert_serial || "",
    bodyXml
  );

  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    SOAP_ACTIONS.check_status
  );

  // Audit trail
  await supabase.from("erct_audit_log").insert({
    user_id: userId,
    action: "check_filing_status",
    request_xml: soapXml,
    response_xml: responseXml,
    http_status: status,
    success: status === 200,
    referenced_entity_type: "revenue_filing",
    referenced_entity_id: filingId,
  });

  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    return new Response(
      JSON.stringify({
        error: "Status check failed",
        detail: fault || `HTTP ${status}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const revenueStatus = extractXmlValue(responseXml, "Status") || "unknown";
  const message = extractXmlValue(responseXml, "Message") || null;

  // Update filing status
  await supabase
    .from("revenue_filings")
    .update({
      revenue_status: revenueStatus,
      status: revenueStatus === "accepted" || revenueStatus === "processed"
        ? "filed"
        : revenueStatus === "rejected"
          ? "rejected"
          : "pending",
    })
    .eq("id", filingId);

  return new Response(
    JSON.stringify({
      filingId,
      filingReference: filing.filing_reference,
      status: revenueStatus,
      message,
      returnType: filing.return_type,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
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

    const authClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limit: 5 filings per minute
    const rl = checkRateLimit(user.id, "revenue-ros-file", 5);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    const supabase = createClient(
      SUPABASE_URL!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { action, ...params } = await req.json();
    const credentials = await getAgentCredentials(supabase, user.id);

    switch (action) {
      case "file_vat3":
      case "file_ct1":
      case "file_form11": {
        const returnTypeMap: Record<string, string> = {
          file_vat3: "VAT3",
          file_ct1: "CT1",
          file_form11: "Form11",
        };
        return await handleFileReturn(supabase, user.id, credentials, {
          ...params,
          returnType: returnTypeMap[action],
        } as any);
      }

      case "check_status":
        return await handleCheckStatus(supabase, user.id, credentials, params as any);

      default:
        return new Response(
          JSON.stringify({
            error: `Invalid action: ${action}. Valid: file_vat3, file_ct1, file_form11, check_status`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("[revenue-ros-file] Error:", error);
    const message =
      error instanceof Error ? error.message : "An internal error occurred";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
