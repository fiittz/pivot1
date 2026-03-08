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

// Revenue PAYE Employer REST API endpoints
const REVENUE_PAYE_ENDPOINTS = {
  test: "https://softwaretest.ros.ie/paye-employers/v1/",
  production: "https://ros.ie/paye-employers/v1/",
};

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
 * Build the Authorization header for Revenue PAYE REST API.
 *
 * TODO: Revenue PAYE API uses ROS digital certificate authentication.
 * The exact auth mechanism (mutual TLS / bearer token / OAuth) depends on
 * Revenue's developer documentation. This is a placeholder that will need
 * to be updated once the developer account is set up.
 */
function buildRevenueAuthHeaders(credentials: {
  tain: string;
  tax_registration_number: string;
  ros_cert_serial: string | null;
}, employerRegNumber?: string): Record<string, string> {
  // TODO: Replace with actual Revenue PAYE API authentication
  // Revenue's REST API likely requires either:
  // 1. Mutual TLS with the ROS digital certificate
  // 2. An OAuth2 bearer token obtained via ROS cert
  // 3. A signed request using the certificate's private key
  return {
    "Content-Type": "application/json",
    "X-Agent-TAIN": credentials.tain,
    "X-Agent-Tax-Ref": credentials.tax_registration_number,
    ...(employerRegNumber
      ? { "X-Employer-Reg-Number": employerRegNumber }
      : {}),
    ...(credentials.ros_cert_serial
      ? { "X-Cert-Serial": credentials.ros_cert_serial }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Action: lookup_rpn
// ---------------------------------------------------------------------------

async function handleLookupRPN(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: {
    tain?: string;
    employerRegNumber?: string;
    employeePpsn: string;
    employeeId: string;
    taxYear: number;
  }
): Promise<Response> {
  const { employeePpsn, employeeId, taxYear } = params;
  const employerRegNumber = params.employerRegNumber;

  if (!employeePpsn) {
    return errorResponse("employeePpsn is required.", 400);
  }
  if (!employeeId) {
    return errorResponse("employeeId is required.", 400);
  }
  if (!taxYear || !Number.isInteger(taxYear)) {
    return errorResponse("taxYear must be a valid integer.", 400);
  }
  if (!employerRegNumber) {
    return errorResponse(
      "employerRegNumber is required. Either pass it in the request or configure it in Revenue credentials.",
      400
    );
  }

  // Verify the employee belongs to this user (or their accountant client)
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, ppsn, first_name, last_name")
    .eq("id", employeeId)
    .single();

  if (empError || !employee) {
    return errorResponse("Employee not found or access denied.", 404);
  }

  const baseUrl = credentials.test_mode
    ? REVENUE_PAYE_ENDPOINTS.test
    : REVENUE_PAYE_ENDPOINTS.production;

  const authHeaders = buildRevenueAuthHeaders(credentials, employerRegNumber!);

  // TODO: The exact RPN lookup endpoint path and request body structure
  // needs to be verified against Revenue's PAYE Employer REST API docs.
  // The structure below is based on the known data requirements.
  const rpnRequestBody = {
    employerRegistrationNumber: employerRegNumber,
    taxYear: taxYear,
    employees: [
      {
        employeePpsn: employeePpsn,
        employmentId: "1", // TODO: May need to be dynamically set
      },
    ],
  };

  console.log(
    `[revenue-paye] lookup_rpn ppsn=${employeePpsn.substring(0, 4)}****, year=${taxYear}, test_mode=${credentials.test_mode}`
  );

  let revenueResponse: { status: number; body: string };
  try {
    // TODO: Confirm endpoint path — likely /rpn or /rpn/lookup
    const response = await fetch(`${baseUrl}rpn`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(rpnRequestBody),
    });

    revenueResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[revenue-paye] lookup_rpn fetch error:", fetchError);
    return errorResponse(
      "Failed to connect to Revenue PAYE API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  // Parse the response
  let rpnData: Record<string, unknown>;
  try {
    rpnData = JSON.parse(revenueResponse.body);
  } catch {
    console.error(
      "[revenue-paye] lookup_rpn: non-JSON response:",
      revenueResponse.body.substring(0, 500)
    );
    return errorResponse(
      "Unexpected response format from Revenue",
      502,
      `HTTP ${revenueResponse.status}`
    );
  }

  if (revenueResponse.status !== 200) {
    console.error(
      `[revenue-paye] lookup_rpn failed: HTTP ${revenueResponse.status}`,
      rpnData
    );
    return errorResponse(
      "Revenue RPN lookup failed",
      502,
      (rpnData as any)?.error || `HTTP ${revenueResponse.status}`
    );
  }

  // TODO: Map the actual Revenue response fields to our schema.
  // The field names below are based on expected RPN data. Revenue's actual
  // JSON response keys will need to be mapped once API docs are available.
  const rpnRecord = {
    user_id: userId,
    employee_id: employeeId,
    tax_year: taxYear,
    ppsn: employeePpsn,
    tax_credits: (rpnData as any)?.taxCredits ?? null,
    standard_rate_cutoff: (rpnData as any)?.standardRateCutOff ?? null,
    usc_status: (rpnData as any)?.uscStatus ?? "normal",
    prsi_class: (rpnData as any)?.prsiClass ?? "A1",
    previous_pay: (rpnData as any)?.previousPay ?? 0,
    previous_tax: (rpnData as any)?.previousTax ?? 0,
    previous_usc: (rpnData as any)?.previousUsc ?? 0,
    previous_prsi: (rpnData as any)?.previousPrsi ?? 0,
    effective_date: (rpnData as any)?.effectiveDate ?? null,
    rpn_number: (rpnData as any)?.rpnNumber ?? null,
    fetched_at: new Date().toISOString(),
    revenue_response: rpnData,
  };

  // Upsert into employee_rpns (unique on employee_id + tax_year)
  const { data: savedRpn, error: upsertError } = await supabase
    .from("employee_rpns")
    .upsert(rpnRecord, { onConflict: "employee_id,tax_year" })
    .select()
    .single();

  if (upsertError) {
    console.error("[revenue-paye] Failed to cache RPN:", upsertError);
    // Still return the data even if caching fails
  }

  // Also update the employee record with the RPN tax details
  const { error: empUpdateError } = await supabase
    .from("employees")
    .update({
      tax_credits_yearly: rpnRecord.tax_credits,
      standard_rate_cut_off_yearly: rpnRecord.standard_rate_cutoff,
      usc_status:
        rpnRecord.usc_status === "exempt"
          ? "exempt"
          : rpnRecord.usc_status === "reduced"
            ? "reduced"
            : "ordinary",
      prsi_class: rpnRecord.prsi_class,
      rpn_number: rpnRecord.rpn_number,
      rpn_effective_date: rpnRecord.effective_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);

  if (empUpdateError) {
    console.error(
      "[revenue-paye] Failed to update employee with RPN data:",
      empUpdateError
    );
  }

  return jsonResponse({
    rpn: savedRpn || rpnRecord,
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
    },
    testMode: credentials.test_mode,
  });
}

// ---------------------------------------------------------------------------
// Action: submit_payroll_submission
// ---------------------------------------------------------------------------

async function handleSubmitPayrollSubmission(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { payrollRunId: string; tain?: string; employerRegNumber?: string }
): Promise<Response> {
  const { payrollRunId } = params;

  if (!payrollRunId) {
    return errorResponse("payrollRunId is required.", 400);
  }

  const employerRegNumber = params.employerRegNumber;
  if (!employerRegNumber) {
    return errorResponse(
      "Employer registration number is required. Configure it in the client's Revenue link.",
      400
    );
  }

  // Fetch the payroll run
  const { data: payrollRun, error: runError } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", payrollRunId)
    .single();

  if (runError || !payrollRun) {
    return errorResponse("Payroll run not found or access denied.", 404);
  }

  if (payrollRun.status === "submitted" || payrollRun.status === "accepted") {
    return errorResponse(
      `Payroll run has already been ${payrollRun.status}.`,
      400
    );
  }

  // Fetch payroll lines with employee details
  const { data: payrollLines, error: linesError } = await supabase
    .from("payroll_lines")
    .select(
      `
      *,
      employee:employees(id, ppsn, first_name, last_name)
    `
    )
    .eq("payroll_run_id", payrollRunId);

  if (linesError) throw linesError;

  if (!payrollLines || payrollLines.length === 0) {
    return errorResponse(
      "No payroll lines found for this run. Calculate payroll first.",
      400
    );
  }

  const baseUrl = credentials.test_mode
    ? REVENUE_PAYE_ENDPOINTS.test
    : REVENUE_PAYE_ENDPOINTS.production;

  const authHeaders = buildRevenueAuthHeaders(credentials, employerRegNumber);

  // TODO: The exact PSR (Payroll Submission Request) JSON structure needs
  // to be verified against Revenue's PAYE Employer REST API documentation.
  // The structure below is based on the known data requirements for a PSR.
  const submissionBody = {
    employerRegistrationNumber: employerRegNumber,
    taxYear: payrollRun.tax_year,
    payrollRun: {
      payFrequency: payrollRun.pay_frequency,
      payPeriod: payrollRun.pay_period,
      payDate: payrollRun.pay_date,
    },
    employees: payrollLines.map((line: any) => ({
      employeePpsn: line.employee?.ppsn,
      employmentId: "1", // TODO: Map to actual employment ID
      firstName: line.employee?.first_name,
      lastName: line.employee?.last_name,
      pay: {
        grossPay: Number(line.gross_pay),
        overtime: Number(line.overtime),
        bonus: Number(line.bonus),
        benefitInKind: Number(line.benefit_in_kind),
      },
      deductions: {
        payeTax: Number(line.paye_tax),
        usc: Number(line.usc),
        employeePrsi: Number(line.employee_prsi),
        pensionEmployee: Number(line.pension_employee),
        otherDeductions: Number(line.other_deductions),
      },
      employerContributions: {
        employerPrsi: Number(line.employer_prsi),
        pensionEmployer: Number(line.pension_employer),
      },
      netPay: Number(line.net_pay),
    })),
  };

  // Create a submission record before sending
  const { data: submission, error: createError } = await supabase
    .from("payroll_submissions")
    .insert({
      user_id: userId,
      payroll_run_id: payrollRunId,
      tax_year: payrollRun.tax_year,
      pay_period: payrollRun.pay_period,
      status: "pending",
      request_payload: submissionBody,
    })
    .select()
    .single();

  if (createError) {
    console.error(
      "[revenue-paye] Failed to create submission record:",
      createError
    );
    throw createError;
  }

  console.log(
    `[revenue-paye] submit_payroll run=${payrollRunId}, year=${payrollRun.tax_year}, period=${payrollRun.pay_period}, employees=${payrollLines.length}, test_mode=${credentials.test_mode}`
  );

  let revenueResponse: { status: number; body: string };
  try {
    // TODO: Confirm endpoint path — likely /payroll/submit or /psr
    const response = await fetch(`${baseUrl}payroll`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(submissionBody),
    });

    revenueResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[revenue-paye] submit_payroll fetch error:", fetchError);

    // Update submission status to error
    await supabase
      .from("payroll_submissions")
      .update({
        status: "error",
        error_details:
          fetchError instanceof Error
            ? fetchError.message
            : "Connection error",
      })
      .eq("id", submission.id);

    return errorResponse(
      "Failed to connect to Revenue PAYE API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  // Parse response
  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(revenueResponse.body);
  } catch {
    console.error(
      "[revenue-paye] submit_payroll: non-JSON response:",
      revenueResponse.body.substring(0, 500)
    );

    await supabase
      .from("payroll_submissions")
      .update({
        status: "error",
        error_details: `Non-JSON response: HTTP ${revenueResponse.status}`,
        response_payload: { raw: revenueResponse.body.substring(0, 2000) },
      })
      .eq("id", submission.id);

    return errorResponse(
      "Unexpected response format from Revenue",
      502,
      `HTTP ${revenueResponse.status}`
    );
  }

  if (revenueResponse.status !== 200 && revenueResponse.status !== 201) {
    console.error(
      `[revenue-paye] submit_payroll failed: HTTP ${revenueResponse.status}`,
      responseData
    );

    await supabase
      .from("payroll_submissions")
      .update({
        status: "rejected",
        response_payload: responseData,
        error_details:
          (responseData as any)?.error ||
          (responseData as any)?.message ||
          `HTTP ${revenueResponse.status}`,
      })
      .eq("id", submission.id);

    return errorResponse(
      "Payroll submission rejected by Revenue",
      502,
      (responseData as any)?.error || `HTTP ${revenueResponse.status}`
    );
  }

  // TODO: Map actual Revenue response fields
  const revenueSubmissionId =
    (responseData as any)?.submissionId ||
    (responseData as any)?.acknowledgementId ||
    null;

  // Update submission record
  await supabase
    .from("payroll_submissions")
    .update({
      status: "submitted",
      submission_id: revenueSubmissionId,
      response_payload: responseData,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  // Update the payroll run status
  await supabase
    .from("payroll_runs")
    .update({
      status: "submitted",
      revenue_submission_id: revenueSubmissionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payrollRunId);

  return jsonResponse({
    submissionId: submission.id,
    revenueSubmissionId,
    payrollRunId,
    status: "submitted",
    employeeCount: payrollLines.length,
    testMode: credentials.test_mode,
  });
}

// ---------------------------------------------------------------------------
// Action: check_submission_status
// ---------------------------------------------------------------------------

async function handleCheckSubmissionStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { submissionId: string }
): Promise<Response> {
  const { submissionId } = params;

  if (!submissionId) {
    return errorResponse("submissionId is required.", 400);
  }

  // Fetch the submission record
  const { data: submission, error: subError } = await supabase
    .from("payroll_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    return errorResponse("Submission not found or access denied.", 404);
  }

  if (!submission.submission_id) {
    return jsonResponse({
      submissionId: submission.id,
      status: submission.status,
      message:
        "No Revenue submission ID — this submission has not been sent to Revenue yet.",
    });
  }

  const baseUrl = credentials.test_mode
    ? REVENUE_PAYE_ENDPOINTS.test
    : REVENUE_PAYE_ENDPOINTS.production;

  const authHeaders = buildRevenueAuthHeaders(credentials);

  console.log(
    `[revenue-paye] check_status submission=${submission.submission_id}, test_mode=${credentials.test_mode}`
  );

  // Note: check_status doesn't need employer_reg_number in headers since
  // we're querying by Revenue's own submission ID

  let revenueResponse: { status: number; body: string };
  try {
    // TODO: Confirm endpoint path — likely /payroll/status/{submissionId}
    const response = await fetch(
      `${baseUrl}payroll/${encodeURIComponent(submission.submission_id)}/status`,
      {
        method: "GET",
        headers: authHeaders,
      }
    );

    revenueResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[revenue-paye] check_status fetch error:", fetchError);
    return errorResponse(
      "Failed to connect to Revenue PAYE API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(revenueResponse.body);
  } catch {
    return errorResponse(
      "Unexpected response format from Revenue",
      502,
      `HTTP ${revenueResponse.status}`
    );
  }

  if (revenueResponse.status !== 200) {
    return errorResponse(
      "Failed to check submission status",
      502,
      (responseData as any)?.error || `HTTP ${revenueResponse.status}`
    );
  }

  // TODO: Map actual Revenue response fields for status
  const revenueStatus =
    (responseData as any)?.status ||
    (responseData as any)?.acknowledgementStatus ||
    "pending";

  const errors = (responseData as any)?.errors || null;

  // Map Revenue status to our status values
  let mappedStatus: string;
  switch (revenueStatus.toLowerCase()) {
    case "accepted":
    case "acknowledged":
      mappedStatus = "accepted";
      break;
    case "rejected":
    case "failed":
      mappedStatus = "rejected";
      break;
    case "pending":
    case "processing":
      mappedStatus = "submitted";
      break;
    default:
      mappedStatus = submission.status;
  }

  // Update the submission record
  const updatePayload: Record<string, unknown> = {
    status: mappedStatus,
    response_payload: responseData,
  };

  if (mappedStatus === "accepted") {
    updatePayload.acknowledged_at = new Date().toISOString();
  }
  if (mappedStatus === "rejected" && errors) {
    updatePayload.error_details =
      typeof errors === "string" ? errors : JSON.stringify(errors);
  }

  await supabase
    .from("payroll_submissions")
    .update(updatePayload)
    .eq("id", submission.id);

  // If accepted, update the payroll run status too
  if (mappedStatus === "accepted") {
    await supabase
      .from("payroll_runs")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submission.payroll_run_id);
  }

  return jsonResponse({
    submissionId: submission.id,
    revenueSubmissionId: submission.submission_id,
    status: mappedStatus,
    revenueStatus,
    errors,
    acknowledgedAt: updatePayload.acknowledged_at || submission.acknowledged_at,
    testMode: credentials.test_mode,
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
    const rl = checkRateLimit(user.id, "revenue-paye", 10);
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
      case "lookup_rpn":
        return await handleLookupRPN(
          supabase,
          user.id,
          credentials,
          params as any
        );

      case "submit_payroll_submission":
        return await handleSubmitPayrollSubmission(
          supabase,
          user.id,
          credentials,
          params as any
        );

      case "check_submission_status":
        return await handleCheckSubmissionStatus(
          supabase,
          user.id,
          credentials,
          params as any
        );

      default:
        return errorResponse(
          `Invalid action: ${action}. Valid actions: lookup_rpn, submit_payroll_submission, check_submission_status`,
          400
        );
    }
  } catch (error) {
    console.error("[revenue-paye] Unhandled error:", error);
    const message =
      error instanceof Error ? error.message : "An internal error occurred";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
