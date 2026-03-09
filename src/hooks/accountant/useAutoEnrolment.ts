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

export function useEnrolEmployee(_clientUserId?: string, _taxYear?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeIdOrParams: string | { employeeId: string }) => {
      const params =
        typeof employeeIdOrParams === "string"
          ? { employeeId: employeeIdOrParams }
          : employeeIdOrParams;
      return callNAERSAEdgeFunction("enrol_employee", params);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-employees"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-summary"] });
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

export function useDownloadAEPNs(_clientUserId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { employerRegNumber: string } | undefined) => {
      return callNAERSAEdgeFunction("download_aepns", params ?? {});
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

export function useSubmitContributions(_clientUserId?: string, _taxYear?: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: {
      payrollRunId: string;
      employerRegNumber?: string;
    } | undefined) => {
      return callNAERSAEdgeFunction("submit_contributions", params ?? {});
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

// ---------------------------------------------------------------------------
// Types used by AutoEnrolmentPanel
// ---------------------------------------------------------------------------

export interface AutoEnrolmentEmployee {
  id: string;
  name: string;
  age: number;
  annual_gross: number;
  status: EnrolmentStatus;
  enrolled_date: string | null;
  opt_out_window_end: string | null;
  re_enrolment_date: string | null;
}

interface EnrolmentSummary {
  total_eligible: number;
  enrolled: number;
  opted_out: number;
  exempt: number;
  ineligible: number;
}

interface ContributionSummaryData {
  period_label: string | null;
  total_employee: number;
  total_employer: number;
  total_state_topup: number;
  submission_status: string;
  submitted_at: string | null;
}

interface AEPNInfoData {
  last_download: string | null;
  new_count: number;
}

// ---------------------------------------------------------------------------
// 10. useAutoEnrolmentEmployees — join enrolment status with employee details
// ---------------------------------------------------------------------------

export function useAutoEnrolmentEmployees(
  clientUserId: string | undefined,
  _taxYear: number
) {
  return useQuery<AutoEnrolmentEmployee[]>({
    queryKey: ["auto-enrolment-employees", clientUserId, _taxYear],
    queryFn: async () => {
      // 1. Fetch ALL active employees for this client
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, date_of_birth, annual_salary, employment_start_date")
        .eq("user_id", clientUserId!)
        .eq("is_active", true);

      if (empError) throw empError;
      if (!employees || employees.length === 0) return [];

      // 2. Fetch any existing enrolment records
      const { data: enrolments, error: enrolError } = await supabase
        .from("employee_auto_enrolment")
        .select("*")
        .eq("user_id", clientUserId!);

      if (enrolError) throw enrolError;

      const enrolMap = new Map(
        (enrolments ?? []).map((e) => [e.employee_id, e])
      );

      // 3. Merge — employees without enrolment records show as "pending"
      return employees.map((emp) => {
        const enr = enrolMap.get(emp.id);
        const dob = emp.date_of_birth ? new Date(emp.date_of_birth) : null;
        const age = dob
          ? Math.floor(
              (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
            )
          : 0;

        return {
          id: emp.id,
          name: `${emp.first_name ?? ""} ${emp.last_name ?? ""}`.trim(),
          age,
          annual_gross: emp.annual_salary ?? 0,
          status: (enr?.status as EnrolmentStatus) ?? "pending",
          enrolled_date: enr?.enrolled_at ?? null,
          opt_out_window_end: enr?.opt_out_window_end ?? null,
          re_enrolment_date: enr?.next_re_enrolment_date ?? null,
        } satisfies AutoEnrolmentEmployee;
      });
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// 11. useAutoEnrolmentSummary — aggregate counts by status
// ---------------------------------------------------------------------------

export function useAutoEnrolmentSummary(
  clientUserId: string | undefined,
  taxYear: number
) {
  const { data: employees } = useAutoEnrolmentEmployees(clientUserId, taxYear);

  return useQuery<EnrolmentSummary>({
    queryKey: ["auto-enrolment-summary", clientUserId, taxYear, employees?.length],
    queryFn: async () => {
      const list = employees ?? [];
      return {
        total_eligible: list.filter(
          (e) => e.status !== "ineligible" && e.status !== "exempt"
        ).length,
        enrolled: list.filter((e) => e.status === "enrolled").length,
        opted_out: list.filter((e) => e.status === "opted_out").length,
        exempt: list.filter((e) => e.status === "exempt").length,
        ineligible: list.filter((e) => e.status === "ineligible").length,
      };
    },
    enabled: !!employees,
  });
}

// ---------------------------------------------------------------------------
// 12. useContributionSummary — aggregate contributions for the current period
// ---------------------------------------------------------------------------

export function useContributionSummary(
  clientUserId: string | undefined,
  taxYear: number
) {
  return useQuery<ContributionSummaryData>({
    queryKey: ["auto-enrolment-contribution-summary", clientUserId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_enrolment_contributions")
        .select("*")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .order("pay_period", { ascending: false });

      if (error) throw error;

      const rows = data ?? [];
      const totalEmployee = rows.reduce((s, r) => s + (r.employee_contribution ?? 0), 0);
      const totalEmployer = rows.reduce((s, r) => s + (r.employer_contribution ?? 0), 0);
      const totalState = rows.reduce((s, r) => s + (r.state_top_up ?? 0), 0);

      // Check latest NAERSA submission status
      const { data: submissions } = await supabase
        .from("naersa_submissions")
        .select("status, submitted_at")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .order("created_at", { ascending: false })
        .limit(1);

      const latest = submissions?.[0];

      return {
        period_label: rows.length > 0 ? `${taxYear} — ${rows.length} period(s)` : null,
        total_employee: totalEmployee,
        total_employer: totalEmployer,
        total_state_topup: totalState,
        submission_status: latest?.status ?? "pending",
        submitted_at: latest?.submitted_at ?? null,
      };
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// 13. useAEPNInfo — AEPN download status
// ---------------------------------------------------------------------------

export function useAEPNInfo(clientUserId: string | undefined) {
  return useQuery<AEPNInfoData>({
    queryKey: ["aepn-info", clientUserId],
    queryFn: async () => {
      // Count enrolments that have an AEPN reference
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .select("aepn_reference, updated_at")
        .eq("user_id", clientUserId!)
        .not("aepn_reference", "is", null)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const rows = data ?? [];
      return {
        last_download: rows.length > 0 ? rows[0].updated_at : null,
        new_count: 0,
      };
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// 14. useSuspendEmployee — suspend an employee's enrolment (panel API)
// ---------------------------------------------------------------------------

export function useSuspendEmployee(_clientUserId: string, _taxYear: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .update({
          status: "suspended",
          suspension_start: new Date().toISOString().split("T")[0],
        })
        .eq("employee_id", employeeId)
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeAutoEnrolment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-employees"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-summary"] });
    },
  });
}

// ---------------------------------------------------------------------------
// 15. useReEnrolEmployee — re-enrol an opted-out employee
// ---------------------------------------------------------------------------

export function useReEnrolEmployee(_clientUserId: string, _taxYear: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employeeId: string) => {
      const { data, error } = await supabase
        .from("employee_auto_enrolment")
        .update({
          status: "enrolled",
          enrolled_at: new Date().toISOString(),
          opted_out_at: null,
          next_re_enrolment_date: null,
        })
        .eq("employee_id", employeeId)
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeAutoEnrolment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-list"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-employees"] });
      queryClient.invalidateQueries({ queryKey: ["auto-enrolment-summary"] });
    },
  });
}
