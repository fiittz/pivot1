import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Revenue eRCT SOAP endpoints
const REVENUE_ENDPOINTS = {
  test: "https://rospublictest.ros.ie/erct-web/",
  production: "https://ros.ie/erct-web/",
};

// ---------------------------------------------------------------------------
// SOAP XML builders
// ---------------------------------------------------------------------------

/**
 * Wrap a SOAP body with the standard envelope, header, and authentication.
 * The agent's TAIN goes in the auth header; the client's registration goes in the body.
 */
function buildSoapEnvelope(
  agentTain: string,
  agentTaxRef: string,
  clientTaxRef: string,
  bodyXml: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:rct="http://www.revenue.ie/schemas/erct">
  <soap:Header>
    <rct:Authentication>
      <rct:AgentTAIN>${agentTain}</rct:AgentTAIN>
      <rct:AgentTaxRegistrationNumber>${agentTaxRef}</rct:AgentTaxRegistrationNumber>
      <rct:PrincipalTaxRegistrationNumber>${clientTaxRef}</rct:PrincipalTaxRegistrationNumber>
    </rct:Authentication>
  </soap:Header>
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;
}

/**
 * TODO: Update SOAP body structure when Revenue XSD schema is integrated.
 * The element names and namespace below are placeholders based on standard
 * SOAP patterns. Revenue's actual eRCT WSDL may use different element names.
 */
function buildRateLookupBody(
  subcontractorTaxRef: string,
  contractId?: string
): string {
  const contractElement = contractId
    ? `<rct:ContractReference>${contractId}</rct:ContractReference>`
    : "";

  // TODO: Verify element names against Revenue eRCT WSDL/XSD
  return `<rct:RateLookupRequest>
      <rct:SubContractorTaxReference>${subcontractorTaxRef}</rct:SubContractorTaxReference>
      ${contractElement}
    </rct:RateLookupRequest>`;
}

/**
 * TODO: Update SOAP body structure when Revenue XSD schema is integrated.
 */
function buildContractNotificationBody(contract: {
  contract_reference: string;
  contract_description: string;
  site_address: string;
  start_date: string;
  estimated_end_date: string;
  estimated_value: number;
}): string {
  // TODO: Verify element names against Revenue eRCT WSDL/XSD
  return `<rct:ContractNotification>
      <rct:ContractReference>${contract.contract_reference}</rct:ContractReference>
      <rct:ContractDescription>${escapeXml(contract.contract_description)}</rct:ContractDescription>
      <rct:SiteAddress>${escapeXml(contract.site_address)}</rct:SiteAddress>
      <rct:StartDate>${contract.start_date}</rct:StartDate>
      <rct:EstimatedEndDate>${contract.estimated_end_date}</rct:EstimatedEndDate>
      <rct:EstimatedValue>${contract.estimated_value}</rct:EstimatedValue>
    </rct:ContractNotification>`;
}

/**
 * TODO: Update SOAP body structure when Revenue XSD schema is integrated.
 */
function buildPaymentNotificationBody(payment: {
  contractReference: string;
  subcontractorTaxRef: string;
  grossAmount: number;
  paymentDate: string;
}): string {
  // TODO: Verify element names against Revenue eRCT WSDL/XSD
  return `<rct:PaymentNotification>
      <rct:ContractReference>${payment.contractReference}</rct:ContractReference>
      <rct:SubContractorTaxReference>${payment.subcontractorTaxRef}</rct:SubContractorTaxReference>
      <rct:GrossPaymentAmount>${payment.grossAmount.toFixed(2)}</rct:GrossPaymentAmount>
      <rct:PaymentDate>${payment.paymentDate}</rct:PaymentDate>
    </rct:PaymentNotification>`;
}

/**
 * TODO: Update SOAP body structure when Revenue XSD schema is integrated.
 */
function buildReturnSubmissionBody(
  periodMonth: number,
  periodYear: number,
  payments: Array<{
    deduction_ref: string;
    subcontractor_tax_ref: string;
    gross_amount: number;
    rct_rate: number;
    rct_deducted: number;
    net_payable: number;
    payment_date: string;
  }>
): string {
  const paymentLines = payments
    .map(
      (p) => `      <rct:PaymentLine>
        <rct:DeductionReference>${p.deduction_ref}</rct:DeductionReference>
        <rct:SubContractorTaxReference>${p.subcontractor_tax_ref}</rct:SubContractorTaxReference>
        <rct:GrossAmount>${p.gross_amount.toFixed(2)}</rct:GrossAmount>
        <rct:RCTRate>${p.rct_rate}</rct:RCTRate>
        <rct:RCTDeducted>${p.rct_deducted.toFixed(2)}</rct:RCTDeducted>
        <rct:NetPayable>${p.net_payable.toFixed(2)}</rct:NetPayable>
        <rct:PaymentDate>${p.payment_date}</rct:PaymentDate>
      </rct:PaymentLine>`
    )
    .join("\n");

  // TODO: Verify element names against Revenue eRCT WSDL/XSD
  return `<rct:ReturnSubmission>
      <rct:PeriodMonth>${String(periodMonth).padStart(2, "0")}</rct:PeriodMonth>
      <rct:PeriodYear>${periodYear}</rct:PeriodYear>
      <rct:PaymentLines>
${paymentLines}
      </rct:PaymentLines>
    </rct:ReturnSubmission>`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Extract text content of a given XML element (simple regex-based parser).
 * Sufficient for the flat Revenue responses we expect. For deeply nested
 * responses, consider a proper XML parser.
 */
function extractXmlValue(xml: string, tagName: string): string | null {
  // Match across namespaces — e.g. <rct:Rate> or <Rate>
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${tagName}[^>]*>([^<]*)<\\/(?:[\\w-]+:)?${tagName}>`,
    "i"
  );
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * Check for a SOAP Fault in the response.
 */
function extractSoapFault(xml: string): string | null {
  const faultString = extractXmlValue(xml, "faultstring");
  if (faultString) return faultString;
  const faultDetail = extractXmlValue(xml, "detail");
  return faultDetail || null;
}

/**
 * Send a SOAP request to Revenue and return the raw XML response.
 */
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

/**
 * Get the accountant's agent credentials from accountant_revenue_credentials.
 */
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
      "Agent credentials not configured. Please set up your TAIN and ROS credentials first."
    );
  }
  return data;
}

/**
 * Store the SOAP request/response XML for audit purposes.
 */
async function storeAuditTrail(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  requestXml: string,
  responseXml: string,
  httpStatus: number,
  success: boolean,
  referencedEntityType?: string,
  referencedEntityId?: string
): Promise<void> {
  const { error } = await supabase.from("erct_audit_log").insert({
    user_id: userId,
    action,
    request_xml: requestXml,
    response_xml: responseXml,
    http_status: httpStatus,
    success,
    referenced_entity_type: referencedEntityType || null,
    referenced_entity_id: referencedEntityId || null,
  });

  if (error) {
    // Log but don't fail the request — audit storage is best-effort
    console.error("Failed to store eRCT audit trail:", error);
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleLookupRate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { subcontractorTaxRef: string; contractId?: string; clientTaxRef?: string }
): Promise<Response> {
  const { subcontractorTaxRef, contractId, clientTaxRef } = params;

  if (!subcontractorTaxRef) {
    return new Response(
      JSON.stringify({ error: "subcontractorTaxRef is required." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const endpoint = credentials.test_mode
    ? REVENUE_ENDPOINTS.test
    : REVENUE_ENDPOINTS.production;

  const bodyXml = buildRateLookupBody(subcontractorTaxRef, contractId);
  const soapXml = buildSoapEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    clientTaxRef || credentials.tax_registration_number,
    bodyXml
  );

  console.log(
    `[revenue-erct] lookup_rate for sub=${subcontractorTaxRef}, test_mode=${credentials.test_mode}`
  );

  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    "RateLookup"
  );

  // Store audit trail
  await storeAuditTrail(
    supabase,
    userId,
    "lookup_rate",
    soapXml,
    responseXml,
    status,
    status === 200,
    "subcontractor_tax_ref",
    subcontractorTaxRef
  );

  // Check for SOAP fault
  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    console.error(`[revenue-erct] lookup_rate SOAP fault: ${fault}`);
    return new Response(
      JSON.stringify({
        error: "Revenue rate lookup failed",
        detail: fault || `HTTP ${status}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Parse rate from response
  const rateStr = extractXmlValue(responseXml, "Rate");
  const rate = rateStr !== null ? parseInt(rateStr, 10) : null;

  if (rate === null || ![0, 20, 35].includes(rate)) {
    console.error(
      `[revenue-erct] Unexpected rate value: ${rateStr} from response`
    );
    return new Response(
      JSON.stringify({
        error: "Unexpected rate value from Revenue",
        detail: `Received: ${rateStr}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Cache the rate lookup result
  const { error: cacheError } = await supabase
    .from("rct_rate_lookups")
    .insert({
      user_id: userId,
      subcontractor_tax_ref: subcontractorTaxRef,
      contract_id: contractId || null,
      rate,
      looked_up_at: new Date().toISOString(),
      response_xml: responseXml,
    });

  if (cacheError) {
    console.error("[revenue-erct] Failed to cache rate lookup:", cacheError);
  }

  return new Response(
    JSON.stringify({
      subcontractorTaxRef,
      rate,
      contractId: contractId || null,
      testMode: credentials.test_mode,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleNotifyContract(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { contractId: string; clientTaxRef?: string }
): Promise<Response> {
  const { contractId } = params;

  if (!contractId) {
    return new Response(
      JSON.stringify({ error: "contractId is required." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Fetch the contract
  const { data: contract, error: contractError } = await supabase
    .from("rct_contracts")
    .select("*")
    .eq("id", contractId)
    .eq("user_id", userId)
    .single();

  if (contractError || !contract) {
    return new Response(
      JSON.stringify({ error: "Contract not found." }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const endpoint = credentials.test_mode
    ? REVENUE_ENDPOINTS.test
    : REVENUE_ENDPOINTS.production;

  const bodyXml = buildContractNotificationBody(contract);
  const soapXml = buildSoapEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    params.clientTaxRef || credentials.tax_registration_number,
    bodyXml
  );

  console.log(
    `[revenue-erct] notify_contract id=${contractId}, test_mode=${credentials.test_mode}`
  );

  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    "ContractNotification"
  );

  // Store audit trail
  await storeAuditTrail(
    supabase,
    userId,
    "notify_contract",
    soapXml,
    responseXml,
    status,
    status === 200,
    "rct_contract",
    contractId
  );

  // Check for SOAP fault
  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    console.error(`[revenue-erct] notify_contract SOAP fault: ${fault}`);

    // Update contract status to reflect the failure
    await supabase
      .from("rct_contracts")
      .update({
        revenue_status: "failed",
        revenue_error: fault || `HTTP ${status}`,
        last_submitted_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        error: "Contract notification failed",
        detail: fault || `HTTP ${status}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Parse Revenue's acknowledgement
  const revenueRef = extractXmlValue(responseXml, "ContractReference");
  const revenueStatus = extractXmlValue(responseXml, "Status") || "accepted";

  // Update contract with Revenue response
  const { error: updateError } = await supabase
    .from("rct_contracts")
    .update({
      revenue_reference: revenueRef,
      revenue_status: revenueStatus,
      revenue_error: null,
      last_submitted_at: new Date().toISOString(),
    })
    .eq("id", contractId)
    .eq("user_id", userId);

  if (updateError) {
    console.error(
      "[revenue-erct] Failed to update contract with Revenue response:",
      updateError
    );
  }

  return new Response(
    JSON.stringify({
      contractId,
      revenueReference: revenueRef,
      status: revenueStatus,
      testMode: credentials.test_mode,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleNotifyPayment(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: {
    invoiceId: string;
    subcontractorId: string;
    grossAmount: number;
    paymentDate: string;
    clientTaxRef?: string;
  }
): Promise<Response> {
  const { invoiceId, subcontractorId, grossAmount, paymentDate } = params;

  // Validate inputs
  if (!invoiceId || !subcontractorId || !grossAmount || !paymentDate) {
    return new Response(
      JSON.stringify({
        error:
          "invoiceId, subcontractorId, grossAmount, and paymentDate are all required.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (
    typeof grossAmount !== "number" ||
    !isFinite(grossAmount) ||
    grossAmount <= 0
  ) {
    return new Response(
      JSON.stringify({ error: "grossAmount must be a positive number." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get subcontractor details
  const { data: subcontractor, error: subError } = await supabase
    .from("subcontractors")
    .select("id, name, tax_reference, rct_rate")
    .eq("id", subcontractorId)
    .eq("user_id", userId)
    .single();

  if (subError || !subcontractor) {
    return new Response(
      JSON.stringify({ error: "Subcontractor not found." }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Find the contract for this subcontractor (use the most recent active one)
  const { data: contract } = await supabase
    .from("rct_contracts")
    .select("contract_reference")
    .eq("user_id", userId)
    .eq("revenue_status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const contractReference = contract?.contract_reference || "UNKNOWN";

  const endpoint = credentials.test_mode
    ? REVENUE_ENDPOINTS.test
    : REVENUE_ENDPOINTS.production;

  const bodyXml = buildPaymentNotificationBody({
    contractReference,
    subcontractorTaxRef: subcontractor.tax_reference,
    grossAmount,
    paymentDate,
  });
  const soapXml = buildSoapEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    params.clientTaxRef || credentials.tax_registration_number,
    bodyXml
  );

  console.log(
    `[revenue-erct] notify_payment invoice=${invoiceId}, sub=${subcontractorId}, gross=${grossAmount}, test_mode=${credentials.test_mode}`
  );

  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    "PaymentNotification"
  );

  // Store audit trail
  await storeAuditTrail(
    supabase,
    userId,
    "notify_payment",
    soapXml,
    responseXml,
    status,
    status === 200,
    "invoice",
    invoiceId
  );

  // Check for SOAP fault
  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    console.error(`[revenue-erct] notify_payment SOAP fault: ${fault}`);
    return new Response(
      JSON.stringify({
        error: "Payment notification failed",
        detail: fault || `HTTP ${status}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Parse Revenue's response
  const deductionRef =
    extractXmlValue(responseXml, "DeductionReference") || null;
  const authorisedRate = extractXmlValue(responseXml, "Rate");
  const rate =
    authorisedRate !== null ? parseInt(authorisedRate, 10) : subcontractor.rct_rate;
  const rctDeducted = Number((grossAmount * (rate / 100)).toFixed(2));
  const netPayable = Number((grossAmount - rctDeducted).toFixed(2));

  const date = new Date(paymentDate);
  const periodMonth = date.getMonth() + 1;
  const periodYear = date.getFullYear();

  // Create payment notification record
  const { data: notification, error: notifError } = await supabase
    .from("rct_payment_notifications")
    .insert({
      user_id: userId,
      invoice_id: invoiceId,
      subcontractor_id: subcontractorId,
      contract_reference: contractReference,
      gross_amount: grossAmount,
      rct_rate: rate,
      rct_deducted: rctDeducted,
      net_payable: netPayable,
      payment_date: paymentDate,
      deduction_reference: deductionRef,
      period_month: periodMonth,
      period_year: periodYear,
      revenue_response_xml: responseXml,
      status: "authorised",
    })
    .select()
    .single();

  if (notifError) {
    console.error(
      "[revenue-erct] Failed to create payment notification record:",
      notifError
    );
    throw notifError;
  }

  // Update the invoice with RCT fields
  const { error: invoiceError } = await supabase
    .from("invoices")
    .update({
      rct_applicable: true,
      rct_rate: rate,
      rct_deducted: rctDeducted,
      rct_net_payable: netPayable,
      rct_deduction_reference: deductionRef,
      rct_payment_notification_id: notification.id,
    })
    .eq("id", invoiceId)
    .eq("user_id", userId);

  if (invoiceError) {
    console.error(
      "[revenue-erct] Failed to update invoice with RCT fields:",
      invoiceError
    );
  }

  // Update subcontractor's cached rate if Revenue returned a different one
  if (rate !== subcontractor.rct_rate) {
    await supabase
      .from("subcontractors")
      .update({ rct_rate: rate })
      .eq("id", subcontractorId)
      .eq("user_id", userId);
  }

  return new Response(
    JSON.stringify({
      invoiceId,
      deductionReference: deductionRef,
      rate,
      grossAmount,
      rctDeducted,
      netPayable,
      notificationId: notification.id,
      testMode: credentials.test_mode,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

async function handleSubmitReturn(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { month: number; year: number; clientTaxRef?: string }
): Promise<Response> {
  const { month, year } = params;

  // Validate period
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return new Response(
      JSON.stringify({ error: "month must be an integer between 1 and 12." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return new Response(
      JSON.stringify({
        error: "year must be an integer between 2020 and 2100.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Get all authorised payment notifications for the period
  const { data: notifications, error: notifError } = await supabase
    .from("rct_payment_notifications")
    .select(
      `
      id,
      deduction_reference,
      subcontractor_id,
      gross_amount,
      rct_rate,
      rct_deducted,
      net_payable,
      payment_date,
      subcontractor:subcontractors(tax_reference)
    `
    )
    .eq("user_id", userId)
    .eq("period_month", month)
    .eq("period_year", year)
    .eq("status", "authorised");

  if (notifError) throw notifError;

  if (!notifications || notifications.length === 0) {
    return new Response(
      JSON.stringify({
        error: `No authorised payment notifications found for ${String(month).padStart(2, "0")}/${year}.`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Build payment lines for the return
  const paymentLines = notifications.map((n: any) => ({
    deduction_ref: n.deduction_reference || "",
    subcontractor_tax_ref: n.subcontractor?.tax_reference || "",
    gross_amount: Number(n.gross_amount),
    rct_rate: Number(n.rct_rate),
    rct_deducted: Number(n.rct_deducted),
    net_payable: Number(n.net_payable),
    payment_date: n.payment_date,
  }));

  const endpoint = credentials.test_mode
    ? REVENUE_ENDPOINTS.test
    : REVENUE_ENDPOINTS.production;

  const bodyXml = buildReturnSubmissionBody(month, year, paymentLines);
  const soapXml = buildSoapEnvelope(
    credentials.tain,
    credentials.tax_registration_number,
    params.clientTaxRef || credentials.tax_registration_number,
    bodyXml
  );

  console.log(
    `[revenue-erct] submit_return period=${String(month).padStart(2, "0")}/${year}, payments=${notifications.length}, test_mode=${credentials.test_mode}`
  );

  const { status, body: responseXml } = await sendSoapRequest(
    endpoint,
    soapXml,
    "ReturnSubmission"
  );

  // Store audit trail
  await storeAuditTrail(
    supabase,
    userId,
    "submit_return",
    soapXml,
    responseXml,
    status,
    status === 200,
    "rct_return",
    `${year}-${String(month).padStart(2, "0")}`
  );

  // Check for SOAP fault
  const fault = extractSoapFault(responseXml);
  if (fault || status !== 200) {
    console.error(`[revenue-erct] submit_return SOAP fault: ${fault}`);
    return new Response(
      JSON.stringify({
        error: "Return submission failed",
        detail: fault || `HTTP ${status}`,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Parse Revenue acknowledgement
  const returnReference =
    extractXmlValue(responseXml, "ReturnReference") || null;
  const returnStatus = extractXmlValue(responseXml, "Status") || "submitted";

  // Calculate totals
  const totals = paymentLines.reduce(
    (acc, p) => ({
      grossTotal: acc.grossTotal + p.gross_amount,
      rctTotal: acc.rctTotal + p.rct_deducted,
      netTotal: acc.netTotal + p.net_payable,
    }),
    { grossTotal: 0, rctTotal: 0, netTotal: 0 }
  );

  // Mark all payment notifications as included in the return
  const notificationIds = notifications.map((n: any) => n.id);
  await supabase
    .from("rct_payment_notifications")
    .update({
      status: "returned",
      return_reference: returnReference,
      returned_at: new Date().toISOString(),
    })
    .in("id", notificationIds)
    .eq("user_id", userId);

  return new Response(
    JSON.stringify({
      period: { month, year },
      returnReference,
      status: returnStatus,
      paymentCount: notifications.length,
      totals: {
        grossTotal: Number(totals.grossTotal.toFixed(2)),
        rctTotal: Number(totals.rctTotal.toFixed(2)),
        netTotal: Number(totals.netTotal.toFixed(2)),
      },
      testMode: credentials.test_mode,
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

    // Auth client — only used to verify the JWT
    const authClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Rate limit: 10 requests per minute (Revenue API calls are expensive)
    const rl = checkRateLimit(user.id, "revenue-erct", 10);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterMs!, corsHeaders);
    }

    // User client — uses the caller's JWT so RLS is enforced
    const supabase = createClient(
      SUPABASE_URL!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { action, ...params } = await req.json();

    // Get agent credentials (determines test vs production)
    const credentials = await getAgentCredentials(supabase, user.id);

    switch (action) {
      case "lookup_rate":
        return await handleLookupRate(supabase, user.id, credentials, params as any);

      case "notify_contract":
        return await handleNotifyContract(supabase, user.id, credentials, params as any);

      case "notify_payment":
        return await handleNotifyPayment(supabase, user.id, credentials, params as any);

      case "submit_return":
        return await handleSubmitReturn(supabase, user.id, credentials, params as any);

      default:
        return new Response(
          JSON.stringify({
            error: `Invalid action: ${action}. Valid actions: lookup_rate, notify_contract, notify_payment, submit_return`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("[revenue-erct] Unhandled error:", error);
    const message =
      error instanceof Error ? error.message : "An internal error occurred";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
