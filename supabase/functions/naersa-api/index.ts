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

// NAERSA (MyFutureFund) API endpoints
// TODO: Confirm exact paths when NAERSA developer documentation is available
const NAERSA_ENDPOINTS = {
  test: "https://api.myfuturefund-nonprod.ie/",
  production: "https://api.myfuturefund.ie/",
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
 * NAERSA uses the same ROS digital certs as PAYE.
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
 * Build auth headers for the NAERSA API.
 *
 * TODO: NAERSA API authentication mechanism is not yet finalised.
 * It will likely use the same ROS digital certificate as Revenue PAYE.
 * Update this once the NAERSA developer docs are published.
 */
function buildNAERSAAuthHeaders(credentials: {
  tain: string;
  tax_registration_number: string;
  ros_cert_serial: string | null;
}, employerRegNumber?: string): Record<string, string> {
  // TODO: Replace with actual NAERSA API authentication
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
// Action: download_aepns
// Download Automatic Enrolment Payroll Notifications from NAERSA
// ---------------------------------------------------------------------------

async function handleDownloadAEPNs(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { employerRegNumber: string }
): Promise<Response> {
  const { employerRegNumber } = params;

  if (!employerRegNumber) {
    return errorResponse("employerRegNumber is required.", 400);
  }

  const baseUrl = credentials.test_mode
    ? NAERSA_ENDPOINTS.test
    : NAERSA_ENDPOINTS.production;

  const authHeaders = buildNAERSAAuthHeaders(credentials, employerRegNumber);

  console.log(
    `[naersa-api] download_aepns employer=${employerRegNumber}, test_mode=${credentials.test_mode}`
  );

  // TODO: Confirm exact endpoint path from NAERSA API docs
  let naersaResponse: { status: number; body: string };
  try {
    const response = await fetch(`${baseUrl}aepn/download`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        employerRegistrationNumber: employerRegNumber,
      }),
    });

    naersaResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[naersa-api] download_aepns fetch error:", fetchError);
    return errorResponse(
      "Failed to connect to NAERSA API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  // Parse response
  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(naersaResponse.body);
  } catch {
    console.error(
      "[naersa-api] download_aepns: non-JSON response:",
      naersaResponse.body.substring(0, 500)
    );
    return errorResponse(
      "Unexpected response format from NAERSA",
      502,
      `HTTP ${naersaResponse.status}`
    );
  }

  if (naersaResponse.status !== 200) {
    console.error(
      `[naersa-api] download_aepns failed: HTTP ${naersaResponse.status}`,
      responseData
    );
    return errorResponse(
      "NAERSA AEPN download failed",
      502,
      (responseData as any)?.error || `HTTP ${naersaResponse.status}`
    );
  }

  // TODO: Map actual NAERSA response fields. The structure below is based on
  // expected AEPN data — each entry represents an employee to be enrolled.
  const aepns = (responseData as any)?.aepns || (responseData as any)?.employees || [];
  let processedCount = 0;

  for (const aepn of aepns) {
    // TODO: Map NAERSA employee identifiers to our employee records.
    // Likely match on PPSN.
    const ppsn = aepn.ppsn || aepn.employeePpsn;
    if (!ppsn) continue;

    // Find matching employee
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("ppsn", ppsn)
      .single();

    if (!employee) {
      console.warn(`[naersa-api] No employee found for PPSN ${ppsn.substring(0, 4)}****`);
      continue;
    }

    // Upsert the auto-enrolment record
    const { error: upsertError } = await supabase
      .from("employee_auto_enrolment")
      .upsert(
        {
          user_id: userId,
          employee_id: employee.id,
          status: "pending",
          aepn_reference: aepn.aepnReference || aepn.reference || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "employee_id" }
      );

    if (upsertError) {
      console.error(
        `[naersa-api] Failed to upsert auto-enrolment for employee ${employee.id}:`,
        upsertError
      );
      continue;
    }

    processedCount++;
  }

  return jsonResponse({
    employerRegNumber,
    totalAEPNs: aepns.length,
    processedCount,
    testMode: credentials.test_mode,
  });
}

// ---------------------------------------------------------------------------
// Action: submit_contributions
// Submit contributions to NAERSA after a payroll run
// ---------------------------------------------------------------------------

async function handleSubmitContributions(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { payrollRunId: string; employerRegNumber?: string }
): Promise<Response> {
  const { payrollRunId } = params;

  if (!payrollRunId) {
    return errorResponse("payrollRunId is required.", 400);
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

  const employerRegNumber = params.employerRegNumber;
  if (!employerRegNumber) {
    return errorResponse(
      "employerRegNumber is required. Either pass it in the request or configure it in the client's Revenue link.",
      400
    );
  }

  // Fetch contribution records for this payroll run
  const { data: contributions, error: contribError } = await supabase
    .from("auto_enrolment_contributions")
    .select("*")
    .eq("payroll_run_id", payrollRunId)
    .eq("submitted_to_naersa", false);

  if (contribError) throw contribError;

  if (!contributions || contributions.length === 0) {
    return errorResponse(
      "No unsubmitted auto-enrolment contributions found for this payroll run.",
      400
    );
  }

  // Calculate totals
  const totalEmployee = contributions.reduce(
    (sum: number, c: any) => sum + Number(c.employee_contribution),
    0
  );
  const totalEmployer = contributions.reduce(
    (sum: number, c: any) => sum + Number(c.employer_contribution),
    0
  );

  const baseUrl = credentials.test_mode
    ? NAERSA_ENDPOINTS.test
    : NAERSA_ENDPOINTS.production;

  const authHeaders = buildNAERSAAuthHeaders(credentials, employerRegNumber);

  // TODO: Confirm exact NAERSA submission JSON structure from API docs
  const submissionBody = {
    employerRegistrationNumber: employerRegNumber,
    taxYear: payrollRun.tax_year,
    payPeriod: payrollRun.pay_period,
    contributions: contributions.map((c: any) => ({
      employeeId: c.employee_id,
      pensionableEarnings: Number(c.pensionable_earnings),
      employeeContribution: Number(c.employee_contribution),
      employerContribution: Number(c.employer_contribution),
      stateTopUp: Number(c.state_top_up),
      totalContribution: Number(c.total_contribution),
      employeeRate: Number(c.employee_rate),
      employerRate: Number(c.employer_rate),
      stateRate: Number(c.state_rate),
    })),
  };

  // Create a submission record before sending
  const { data: submission, error: createError } = await supabase
    .from("naersa_submissions")
    .insert({
      user_id: userId,
      payroll_run_id: payrollRunId,
      employer_reg_number: employerRegNumber,
      tax_year: payrollRun.tax_year,
      pay_period: payrollRun.pay_period,
      total_employee_contributions: Number(totalEmployee.toFixed(2)),
      total_employer_contributions: Number(totalEmployer.toFixed(2)),
      employee_count: contributions.length,
      status: "pending",
      request_payload: submissionBody,
    })
    .select()
    .single();

  if (createError) {
    console.error(
      "[naersa-api] Failed to create submission record:",
      createError
    );
    throw createError;
  }

  console.log(
    `[naersa-api] submit_contributions run=${payrollRunId}, year=${payrollRun.tax_year}, period=${payrollRun.pay_period}, employees=${contributions.length}, test_mode=${credentials.test_mode}`
  );

  // TODO: Confirm exact endpoint path from NAERSA API docs
  let naersaResponse: { status: number; body: string };
  try {
    const response = await fetch(`${baseUrl}contributions/submit`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(submissionBody),
    });

    naersaResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[naersa-api] submit_contributions fetch error:", fetchError);

    // Update submission status to error
    await supabase
      .from("naersa_submissions")
      .update({
        status: "error",
        error_details:
          fetchError instanceof Error
            ? fetchError.message
            : "Connection error",
      })
      .eq("id", submission.id);

    return errorResponse(
      "Failed to connect to NAERSA API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  // Parse response
  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(naersaResponse.body);
  } catch {
    console.error(
      "[naersa-api] submit_contributions: non-JSON response:",
      naersaResponse.body.substring(0, 500)
    );

    await supabase
      .from("naersa_submissions")
      .update({
        status: "error",
        error_details: `Non-JSON response: HTTP ${naersaResponse.status}`,
        response_payload: { raw: naersaResponse.body.substring(0, 2000) },
      })
      .eq("id", submission.id);

    return errorResponse(
      "Unexpected response format from NAERSA",
      502,
      `HTTP ${naersaResponse.status}`
    );
  }

  if (naersaResponse.status !== 200 && naersaResponse.status !== 201) {
    console.error(
      `[naersa-api] submit_contributions failed: HTTP ${naersaResponse.status}`,
      responseData
    );

    await supabase
      .from("naersa_submissions")
      .update({
        status: "rejected",
        response_payload: responseData,
        error_details:
          (responseData as any)?.error ||
          (responseData as any)?.message ||
          `HTTP ${naersaResponse.status}`,
      })
      .eq("id", submission.id);

    return errorResponse(
      "Contribution submission rejected by NAERSA",
      502,
      (responseData as any)?.error || `HTTP ${naersaResponse.status}`
    );
  }

  // TODO: Map actual NAERSA response fields
  const submissionRef =
    (responseData as any)?.submissionReference ||
    (responseData as any)?.submissionId ||
    null;

  // Update submission record
  await supabase
    .from("naersa_submissions")
    .update({
      status: "submitted",
      submission_ref: submissionRef,
      response_payload: responseData,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", submission.id);

  // Mark contribution records as submitted
  const contributionIds = contributions.map((c: any) => c.id);
  await supabase
    .from("auto_enrolment_contributions")
    .update({
      submitted_to_naersa: true,
      naersa_submission_ref: submissionRef,
    })
    .in("id", contributionIds);

  return jsonResponse({
    submissionId: submission.id,
    submissionRef,
    payrollRunId,
    status: "submitted",
    employeeCount: contributions.length,
    totalEmployeeContributions: Number(totalEmployee.toFixed(2)),
    totalEmployerContributions: Number(totalEmployer.toFixed(2)),
    testMode: credentials.test_mode,
  });
}

// ---------------------------------------------------------------------------
// Action: check_status
// Check the status of a NAERSA submission
// ---------------------------------------------------------------------------

async function handleCheckStatus(
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
    .from("naersa_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subError || !submission) {
    return errorResponse("Submission not found or access denied.", 404);
  }

  if (!submission.submission_ref) {
    return jsonResponse({
      submissionId: submission.id,
      status: submission.status,
      message:
        "No NAERSA submission reference -- this submission has not been sent to NAERSA yet.",
    });
  }

  const baseUrl = credentials.test_mode
    ? NAERSA_ENDPOINTS.test
    : NAERSA_ENDPOINTS.production;

  const authHeaders = buildNAERSAAuthHeaders(credentials);

  console.log(
    `[naersa-api] check_status submission=${submission.submission_ref}, test_mode=${credentials.test_mode}`
  );

  // TODO: Confirm exact endpoint path from NAERSA API docs
  let naersaResponse: { status: number; body: string };
  try {
    const response = await fetch(
      `${baseUrl}contributions/status/${encodeURIComponent(submission.submission_ref)}`,
      {
        method: "GET",
        headers: authHeaders,
      }
    );

    naersaResponse = {
      status: response.status,
      body: await response.text(),
    };
  } catch (fetchError) {
    console.error("[naersa-api] check_status fetch error:", fetchError);
    return errorResponse(
      "Failed to connect to NAERSA API",
      502,
      fetchError instanceof Error ? fetchError.message : "Connection error"
    );
  }

  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(naersaResponse.body);
  } catch {
    return errorResponse(
      "Unexpected response format from NAERSA",
      502,
      `HTTP ${naersaResponse.status}`
    );
  }

  if (naersaResponse.status !== 200) {
    return errorResponse(
      "Failed to check submission status",
      502,
      (responseData as any)?.error || `HTTP ${naersaResponse.status}`
    );
  }

  // TODO: Map actual NAERSA response fields for status
  const naersaStatus =
    (responseData as any)?.status ||
    (responseData as any)?.acknowledgementStatus ||
    "pending";

  const errors = (responseData as any)?.errors || null;

  // Map NAERSA status to our status values
  let mappedStatus: string;
  switch (naersaStatus.toLowerCase()) {
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
    .from("naersa_submissions")
    .update(updatePayload)
    .eq("id", submission.id);

  return jsonResponse({
    submissionId: submission.id,
    submissionRef: submission.submission_ref,
    status: mappedStatus,
    naersaStatus,
    errors,
    acknowledgedAt: updatePayload.acknowledged_at || submission.acknowledged_at,
    testMode: credentials.test_mode,
  });
}

// ---------------------------------------------------------------------------
// Action: enrol_employee
// Manually trigger enrolment for an employee
// ---------------------------------------------------------------------------

async function handleEnrolEmployee(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  _credentials: Awaited<ReturnType<typeof getAgentCredentials>>,
  params: { employeeId: string }
): Promise<Response> {
  const { employeeId } = params;

  if (!employeeId) {
    return errorResponse("employeeId is required.", 400);
  }

  // Verify the employee exists and belongs to this user (or their accountant client)
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, first_name, last_name")
    .eq("id", employeeId)
    .single();

  if (empError || !employee) {
    return errorResponse("Employee not found or access denied.", 404);
  }

  const now = new Date();
  const enrolledAt = now.toISOString();

  // Opt-out window: starts 6 months after enrolment
  const optOutWindowStart = new Date(now);
  optOutWindowStart.setMonth(optOutWindowStart.getMonth() + 6);

  // Opt-out window: ends 2 months after window start (8 months after enrolment)
  const optOutWindowEnd = new Date(optOutWindowStart);
  optOutWindowEnd.setMonth(optOutWindowEnd.getMonth() + 2);

  // Upsert the auto-enrolment record
  const { data: enrolment, error: upsertError } = await supabase
    .from("employee_auto_enrolment")
    .upsert(
      {
        user_id: userId,
        employee_id: employeeId,
        status: "enrolled",
        enrolled_at: enrolledAt,
        opt_out_window_start: optOutWindowStart.toISOString().split("T")[0],
        opt_out_window_end: optOutWindowEnd.toISOString().split("T")[0],
        opted_out_at: null,
        next_re_enrolment_date: null,
        suspension_start: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "employee_id" }
    )
    .select()
    .single();

  if (upsertError) {
    console.error(
      "[naersa-api] Failed to enrol employee:",
      upsertError
    );
    throw upsertError;
  }

  console.log(
    `[naersa-api] enrol_employee id=${employeeId}, name=${employee.first_name} ${employee.last_name}`
  );

  return jsonResponse({
    enrolment,
    employee: {
      id: employee.id,
      name: `${employee.first_name} ${employee.last_name}`,
    },
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

    // Rate limit: 10 requests per minute (NAERSA API calls are expensive)
    const rl = checkRateLimit(user.id, "naersa-api", 10);
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
      case "download_aepns":
        return await handleDownloadAEPNs(
          supabase,
          user.id,
          credentials,
          params as any
        );

      case "submit_contributions":
        return await handleSubmitContributions(
          supabase,
          user.id,
          credentials,
          params as any
        );

      case "check_status":
        return await handleCheckStatus(
          supabase,
          user.id,
          credentials,
          params as any
        );

      case "enrol_employee":
        return await handleEnrolEmployee(
          supabase,
          user.id,
          credentials,
          params as any
        );

      default:
        return errorResponse(
          `Invalid action: ${action}. Valid actions: download_aepns, submit_contributions, check_status, enrol_employee`,
          400
        );
    }
  } catch (error) {
    console.error("[naersa-api] Unhandled error:", error);
    const message =
      error instanceof Error ? error.message : "An internal error occurred";
    const status = message === "Unauthorized" ? 401 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
