import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnrolmentStatus =
  | "pending"
  | "enrolled"
  | "opted_out"
  | "suspended"
  | "exempt"
  | "ineligible";

export interface EmployeeAutoEnrolment {
  id: string;
  user_id: string;
  employee_id: string;
  status: EnrolmentStatus;
  enrolled_at: string | null;
  opt_out_window_start: string | null;
  opt_out_window_end: string | null;
  opted_out_at: string | null;
  next_re_enrolment_date: string | null;
  suspension_start: string | null;
  has_qualifying_pension: boolean;
  qualifying_pension_details: string | null;
  aepn_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoEnrolmentContribution {
  id: string;
  user_id: string;
  employee_id: string;
  payroll_run_id: string | null;
  pay_period: number;
  tax_year: number;
  pensionable_earnings: number;
  employee_contribution: number;
  employer_contribution: number;
  state_top_up: number;
  total_contribution: number;
  employee_rate: number;
  employer_rate: number;
  state_rate: number;
  submitted_to_naersa: boolean;
  naersa_submission_ref: string | null;
  created_at: string;
}

export interface NAERSASubmission {
  id: string;
  user_id: string;
  payroll_run_id: string | null;
  employer_reg_number: string;
  tax_year: number;
  pay_period: number;
  total_employee_contributions: number;
  total_employer_contributions: number;
  employee_count: number;
  submission_ref: string | null;
  status: "pending" | "submitted" | "accepted" | "rejected" | "error";
  request_payload: unknown;
  response_payload: unknown;
  error_details: string | null;
  submitted_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Contribution rates by year range
// ---------------------------------------------------------------------------

export function getContributionRates(taxYear: number) {
  // Phase 1: 2025-2028 -> 1.5% / 1.5% / 0.5%
  // Phase 2: 2029-2031 -> 3% / 3% / 1%
  // Phase 3: 2032+     -> 6% / 6% / 2%
  // Only Phase 1 is legislated so far
  if (taxYear <= 2028) {
    return { employee: 1.5, employer: 1.5, state: 0.5 };
  }
  if (taxYear <= 2031) {
    return { employee: 3, employer: 3, state: 1 };
  }
  return { employee: 6, employer: 6, state: 2 };
}

// ---------------------------------------------------------------------------
// Edge function helper
// ---------------------------------------------------------------------------

async function callNAERSAEdgeFunction(
  action: string,
  params: Record<string, unknown> = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/naersa-api`,
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
    let message: string;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.error || parsed.detail || `Edge function returned ${response.status}`;
    } catch {
      message = errorBody || `Edge function returned ${response.status}`;
    }
    throw new Error(message);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// 1. useEmployeeEnrolment — fetch a single employee's enrolment status
// ---------------------------------------------------------------------------

export function useEmployeeEnrolment(employeeId: string | undefined) {
  return useQuery<EmployeeAutoEnrolment | null>({
    queryKey: ["auto-enrolment", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .select("*")
        .eq("employee_id", employeeId!)
        .maybeSingle();

      if (error) throw error;
      return data as EmployeeAutoEnrolment | null;
    },
    enabled: !!employeeId,
  });
}

// ---------------------------------------------------------------------------
// 2. useAutoEnrolmentList — fetch all employees' enrolment statuses for a client
// ---------------------------------------------------------------------------

export function useAutoEnrolmentList(clientUserId: string | undefined) {
  return useQuery<EmployeeAutoEnrolment[]>({
    queryKey: ["auto-enrolment-list", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as EmployeeAutoEnrolment[];
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// 3. useEnrolEmployee — mutation to enrol an employee via edge function
// ---------------------------------------------------------------------------

export function useEnrolEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { employeeId: string }) => {
      return callNAERSAEdgeFunction("enrol_employee", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      const name = data?.employee?.name || "Employee";
      toast.success(`${name} enrolled in auto-enrolment`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to enrol employee: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 4. useOptOutEmployee — mutation to record opt-out
// ---------------------------------------------------------------------------

export function useOptOutEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { employeeId: string }) => {
      const now = new Date();
      // Set next re-enrolment date to 2 years from now
      const reEnrolmentDate = new Date(now);
      reEnrolmentDate.setFullYear(reEnrolmentDate.getFullYear() + 2);

      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .update({
          status: "opted_out",
          opted_out_at: now.toISOString(),
          next_re_enrolment_date: reEnrolmentDate.toISOString().split("T")[0],
        })
        .eq("employee_id", params.employeeId)
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeAutoEnrolment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      toast.success("Employee opted out of auto-enrolment");
    },
    onError: (error: Error) => {
      toast.error(`Failed to opt out employee: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 5. useSuspendContributions — mutation to suspend contributions
// ---------------------------------------------------------------------------

export function useSuspendContributions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { employeeId: string }) => {
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .update({
          status: "suspended",
          suspension_start: new Date().toISOString().split("T")[0],
        })
        .eq("employee_id", params.employeeId)
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeAutoEnrolment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      toast.success("Contributions suspended");
    },
    onError: (error: Error) => {
      toast.error(`Failed to suspend contributions: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 6. useDownloadAEPNs — mutation to download AEPNs from NAERSA
// ---------------------------------------------------------------------------

export function useDownloadAEPNs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { employerRegNumber: string }) => {
      return callNAERSAEdgeFunction("download_aepns", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      const count = data?.processedCount ?? 0;
      toast.success(`Downloaded ${count} AEPN(s) from NAERSA`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to download AEPNs: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 7. useSubmitContributions — mutation to submit contributions to NAERSA
// ---------------------------------------------------------------------------

export function useSubmitContributions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      payrollRunId: string;
      employerRegNumber?: string;
    }) => {
      return callNAERSAEdgeFunction("submit_contributions", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-contributions"] });
      queryClient.invalidateQueries({ queryKey: ["naersa-submissions"] });
      const count = data?.employeeCount ?? 0;
      toast.success(
        `Submitted contributions for ${count} employee(s) to NAERSA`
      );
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit contributions: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 8. useContributionHistory — fetch contribution records for an employee
// ---------------------------------------------------------------------------

export function useContributionHistory(
  employeeId: string | undefined,
  taxYear: number | undefined
) {
  return useQuery<AutoEnrolmentContribution[]>({
    queryKey: ["auto-enrolment-contributions", employeeId, taxYear],
    queryFn: async () => {
      let query = supabase
        .from("auto_enrolment_contributions")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("pay_period", { ascending: true });

      if (taxYear) {
        query = query.eq("tax_year", taxYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as AutoEnrolmentContribution[];
    },
    enabled: !!employeeId,
  });
}

// ---------------------------------------------------------------------------
// 9. useNAERSASubmissions — fetch submission statuses for a payroll run
// ---------------------------------------------------------------------------

export function useNAERSASubmissions(payrollRunId: string | undefined) {
  return useQuery<NAERSASubmission[]>({
    queryKey: ["naersa-submissions", payrollRunId],
    queryFn: async () => {
      let query = supabase
        .from("naersa_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (payrollRunId) {
        query = query.eq("payroll_run_id", payrollRunId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as NAERSASubmission[];
    },
    // If payrollRunId is undefined, still allow fetching all submissions
    enabled: true,
  });
}
