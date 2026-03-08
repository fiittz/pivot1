import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployeeRPN {
  id: string;
  user_id: string;
  employee_id: string;
  tax_year: number;
  ppsn: string;
  tax_credits: number | null;
  standard_rate_cutoff: number | null;
  usc_status: string;
  prsi_class: string;
  previous_pay: number;
  previous_tax: number;
  previous_usc: number;
  previous_prsi: number;
  effective_date: string | null;
  rpn_number: string | null;
  fetched_at: string;
  revenue_response: Record<string, unknown> | null;
}

export interface PayrollSubmission {
  id: string;
  user_id: string;
  payroll_run_id: string;
  tax_year: number;
  pay_period: number;
  submission_id: string | null;
  status: "pending" | "submitted" | "accepted" | "rejected" | "error";
  request_payload: Record<string, unknown> | null;
  response_payload: Record<string, unknown> | null;
  error_details: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Edge function helper
// ---------------------------------------------------------------------------

async function callPayeEdgeFunction(
  action: string,
  params: Record<string, unknown> = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-paye`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action, ...params }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Edge function returned ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// 1. useEmployeeRPN — fetch cached RPN for an employee + tax year
// ---------------------------------------------------------------------------

export function useEmployeeRPN(
  employeeId: string | undefined,
  taxYear: number | undefined
) {
  return useQuery<EmployeeRPN | null>({
    queryKey: ["employee-rpn", employeeId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_rpns")
        .select("*")
        .eq("employee_id", employeeId!)
        .eq("tax_year", taxYear!)
        .maybeSingle();

      if (error) throw error;
      return data as EmployeeRPN | null;
    },
    enabled: !!employeeId && !!taxYear,
  });
}

// ---------------------------------------------------------------------------
// 2. useFetchRPN — mutation to call Revenue for a fresh RPN lookup
// ---------------------------------------------------------------------------

export function useFetchRPN() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      employeeId: string;
      employeePpsn: string;
      taxYear: number;
      accountantClientId: string;
    }) => {
      // 1. Fetch the accountant's agent credentials
      const { data: agentCreds, error: agentErr } = await supabase
        .from("accountant_revenue_credentials")
        .select("tain, tax_registration_number, test_mode")
        .limit(1)
        .single();

      if (agentErr || !agentCreds) {
        throw new Error("Agent credentials not configured. Set up your TAIN in Revenue Setup first.");
      }

      // 2. Fetch the client's employer_reg_number from accountant_clients
      const { data: clientLink, error: clientErr } = await supabase
        .from("accountant_clients")
        .select("employer_reg_number")
        .eq("id", params.accountantClientId)
        .single();

      if (clientErr || !clientLink?.employer_reg_number) {
        throw new Error("Client employer registration number not configured. Set it in Revenue Setup > Client Revenue Link.");
      }

      const result = await callPayeEdgeFunction("lookup_rpn", {
        employeeId: params.employeeId,
        employeePpsn: params.employeePpsn,
        taxYear: params.taxYear,
        tain: agentCreds.tain,
        employerRegNumber: clientLink.employer_reg_number,
      });
      return result as { rpn: EmployeeRPN; employee: { id: string; name: string }; testMode: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["employee-rpn", data.rpn.employee_id, data.rpn.tax_year],
      });
      queryClient.invalidateQueries({ queryKey: ["employee-rpn"] });
      toast.success(
        `RPN fetched for ${data.employee.name} (${data.rpn.tax_year})`
      );
    },
    onError: (error: Error) => {
      toast.error(`RPN lookup failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 3. usePayrollSubmissions — fetch submissions for a payroll run
// ---------------------------------------------------------------------------

export function usePayrollSubmissions(payrollRunId: string | undefined) {
  return useQuery<PayrollSubmission[]>({
    queryKey: ["payroll-submissions", payrollRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_submissions")
        .select("*")
        .eq("payroll_run_id", payrollRunId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PayrollSubmission[];
    },
    enabled: !!payrollRunId,
  });
}

// ---------------------------------------------------------------------------
// 4. useSubmitPayroll — mutation to submit a payroll run to Revenue
// ---------------------------------------------------------------------------

export function useSubmitPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { payrollRunId: string; accountantClientId: string }) => {
      // 1. Fetch the accountant's agent credentials
      const { data: agentCreds, error: agentErr } = await supabase
        .from("accountant_revenue_credentials")
        .select("tain, tax_registration_number, test_mode")
        .limit(1)
        .single();

      if (agentErr || !agentCreds) {
        throw new Error("Agent credentials not configured. Set up your TAIN in Revenue Setup first.");
      }

      // 2. Fetch the client's employer_reg_number
      const { data: clientLink, error: clientErr } = await supabase
        .from("accountant_clients")
        .select("employer_reg_number")
        .eq("id", params.accountantClientId)
        .single();

      if (clientErr || !clientLink?.employer_reg_number) {
        throw new Error("Client employer registration number not configured. Set it in Revenue Setup > Client Revenue Link.");
      }

      const result = await callPayeEdgeFunction(
        "submit_payroll_submission",
        {
          payrollRunId: params.payrollRunId,
          tain: agentCreds.tain,
          employerRegNumber: clientLink.employer_reg_number,
        }
      );
      return result as {
        submissionId: string;
        revenueSubmissionId: string | null;
        payrollRunId: string;
        status: string;
        employeeCount: number;
        testMode: boolean;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["payroll-submissions", data.payrollRunId],
      });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      toast.success(
        `Payroll submitted to Revenue (${data.employeeCount} employees)`
      );
    },
    onError: (error: Error) => {
      toast.error(`Payroll submission failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 5. useCheckSubmissionStatus — mutation to check status of a submission
// ---------------------------------------------------------------------------

export function useCheckSubmissionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { submissionId: string }) => {
      const result = await callPayeEdgeFunction(
        "check_submission_status",
        params
      );
      return result as {
        submissionId: string;
        revenueSubmissionId: string | null;
        status: string;
        revenueStatus: string;
        errors: unknown;
        acknowledgedAt: string | null;
        testMode: boolean;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["payroll-submissions"],
      });
      queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });

      if (data.status === "accepted") {
        toast.success("Payroll submission accepted by Revenue");
      } else if (data.status === "rejected") {
        toast.error("Payroll submission rejected by Revenue");
      } else {
        toast.info(`Submission status: ${data.status}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Status check failed: ${error.message}`);
    },
  });
}
