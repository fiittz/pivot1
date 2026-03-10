import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  calculatePayroll,
  calculateDividend,
  getDWTDueDate,
  generatePayrollJournalLines,
  generateDividendJournalLines,
  TAX_TABLES_2026,
} from "@/lib/payroll/irishPayrollCalculator";
import type { PayrollInput, PayrollResult } from "@/lib/payroll/irishPayrollCalculator";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface Employee {
  id: string;
  user_id: string;
  created_by: string;
  ppsn: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  job_title: string | null;
  // Address
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  eircode: string | null;
  // Employment
  employment_start_date: string;
  employment_end_date: string | null;
  employment_id: string | null;
  is_director: boolean;
  pay_frequency: "weekly" | "fortnightly" | "monthly";
  annual_salary: number | null;
  // Tax details (from RPN or manual entry)
  tax_basis: "cumulative" | "week1_month1" | "emergency";
  tax_credits_yearly: number;
  standard_rate_cut_off_yearly: number;
  usc_status: "ordinary" | "reduced" | "exempt";
  prsi_class: string;
  rpn_number: string | null;
  rpn_effective_date: string | null;
  // Pension
  pension_employee_pct: number;
  pension_employer_pct: number;
  // Bank
  bank_iban: string | null;
  bank_bic: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PayrollRun {
  id: string;
  user_id: string;
  created_by: string;
  tax_year: number;
  pay_period: number;
  pay_frequency: string;
  pay_date: string;
  status: "draft" | "calculated" | "approved" | "submitted" | "accepted";
  journal_entry_id: string | null;
  revenue_submission_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollLine {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  gross_pay: number;
  overtime: number;
  bonus: number;
  benefit_in_kind: number;
  paye_tax: number;
  usc: number;
  employee_prsi: number;
  pension_employee: number;
  other_deductions: number;
  employer_prsi: number;
  pension_employer: number;
  total_deductions: number;
  net_pay: number;
  total_employer_cost: number;
  cumulative_gross: number;
  cumulative_tax: number;
  cumulative_usc: number;
  cumulative_prsi: number;
  created_at: string;
}

export interface PayrollRunWithLines extends PayrollRun {
  lines: (PayrollLine & { employee?: Employee })[];
}

export interface DividendDeclaration {
  id: string;
  user_id: string;
  created_by: string;
  employee_id: string | null;
  recipient_name: string;
  recipient_ppsn: string | null;
  declaration_date: string;
  payment_date: string | null;
  gross_amount: number;
  dwt_rate: number;
  dwt_amount: number;
  net_amount: number;
  dwt_due_date: string;
  dwt_paid: boolean;
  journal_entry_id: string | null;
  board_resolution_ref: string | null;
  notes: string | null;
  status: "declared" | "paid" | "dwt_filed";
  created_at: string;
}

// ────────────────────────────────────────────
// Employee Queries
// ────────────────────────────────────────────

export function useEmployees(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["employees", clientUserId],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("last_name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as Employee[];
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Employee Mutations
// ────────────────────────────────────────────

export function useCreateEmployee() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      ppsn: string;
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      date_of_birth?: string;
      gender?: "male" | "female" | "other";
      job_title?: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      county?: string;
      eircode?: string;
      employment_start_date: string;
      employment_id?: string;
      is_director?: boolean;
      pay_frequency?: "weekly" | "fortnightly" | "monthly";
      annual_salary?: number;
      tax_basis?: "cumulative" | "week1_month1" | "emergency";
      tax_credits_yearly?: number;
      standard_rate_cut_off_yearly?: number;
      usc_status?: "ordinary" | "reduced" | "exempt";
      prsi_class?: string;
      rpn_number?: string;
      rpn_effective_date?: string;
      pension_employee_pct?: number;
      pension_employer_pct?: number;
      bank_iban?: string;
      bank_bic?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          ...input,
          created_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["employees", variables.user_id] });
      toast.success("Employee added successfully");
    },
    onError: () => {
      toast.error("Failed to add employee");
    },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      updates: Partial<
        Pick<
          Employee,
          | "first_name"
          | "last_name"
          | "email"
          | "phone"
          | "date_of_birth"
          | "gender"
          | "job_title"
          | "address_line1"
          | "address_line2"
          | "city"
          | "county"
          | "eircode"
          | "employment_id"
          | "is_director"
          | "pay_frequency"
          | "annual_salary"
          | "tax_basis"
          | "tax_credits_yearly"
          | "standard_rate_cut_off_yearly"
          | "usc_status"
          | "prsi_class"
          | "rpn_number"
          | "rpn_effective_date"
          | "pension_employee_pct"
          | "pension_employer_pct"
          | "bank_iban"
          | "bank_bic"
          | "notes"
        >
      >;
    }) => {
      const { data, error } = await supabase
        .from("employees")
        .update({ ...input.updates, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["employees", variables.user_id] });
      toast.success("Employee updated");
    },
    onError: () => {
      toast.error("Failed to update employee");
    },
  });
}

export function useDeactivateEmployee() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      employment_end_date: string;
    }) => {
      const { data, error } = await supabase
        .from("employees")
        .update({
          is_active: false,
          employment_end_date: input.employment_end_date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["employees", variables.user_id] });
      toast.success("Employee deactivated");
    },
    onError: () => {
      toast.error("Failed to deactivate employee");
    },
  });
}

// ────────────────────────────────────────────
// Payroll Run Queries
// ────────────────────────────────────────────

export function usePayrollRuns(
  clientUserId: string | null | undefined,
  taxYear: number,
) {
  return useQuery({
    queryKey: ["payroll-runs", clientUserId, taxYear],
    queryFn: async (): Promise<PayrollRun[]> => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .order("pay_period", { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as PayrollRun[];
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePayrollRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["payroll-run", runId],
    queryFn: async (): Promise<PayrollRunWithLines> => {
      // Fetch the run
      const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("id", runId!)
        .maybeSingle();

      if (runError) throw runError;
      if (!run) throw new Error(`Payroll run ${runId} not found`);

      // Fetch lines
      const { data: lines, error: linesError } = await supabase
        .from("payroll_lines")
        .select("*")
        .eq("payroll_run_id", runId!)
        .order("created_at", { ascending: true });

      if (linesError) throw linesError;

      const typedLines = (lines ?? []) as unknown as PayrollLine[];

      // Fetch employees for each line
      const employeeIds = [...new Set(typedLines.map((l) => l.employee_id))];
      let employeeMap = new Map<string, Employee>();

      if (employeeIds.length > 0) {
        const { data: employees, error: empError } = await supabase
          .from("employees")
          .select("*")
          .in("id", employeeIds);

        if (empError) throw empError;

        for (const emp of (employees ?? []) as unknown as Employee[]) {
          employeeMap.set(emp.id, emp);
        }
      }

      const typedRun = run as unknown as PayrollRun;

      return {
        ...typedRun,
        lines: typedLines.map((line) => ({
          ...line,
          employee: employeeMap.get(line.employee_id),
        })),
      };
    },
    enabled: !!runId,
    staleTime: 2 * 60 * 1000,
  });
}

// ────────────────────────────────────────────
// Payroll Run Mutations
// ────────────────────────────────────────────

export function useCreatePayrollRun() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      tax_year: number;
      pay_period: number;
      pay_frequency: "weekly" | "fortnightly" | "monthly";
      pay_date: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .insert({
          ...input,
          created_by: user!.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", variables.user_id, variables.tax_year] });
      toast.success("Payroll run created");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create payroll run");
    },
  });
}

export function useCalculatePayrollRun() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      runId: string;
      clientUserId: string;
      taxYear: number;
      payPeriod: number;
      payFrequency: "weekly" | "fortnightly" | "monthly";
      // Optional overrides per employee: { [employeeId]: { overtime, bonus, benefitInKind } }
      overrides?: Record<string, { overtime?: number; bonus?: number; benefitInKind?: number; grossPay?: number }>;
    }) => {
      // 1. Fetch all active employees for this client
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", input.clientUserId)
        .eq("is_active", true);

      if (empError) throw empError;
      if (!employees || employees.length === 0) throw new Error("No active employees found");

      const typedEmployees = employees as unknown as Employee[];
      const periodsPerYear = input.payFrequency === "weekly" ? 52 : input.payFrequency === "fortnightly" ? 26 : 12;

      // 2. For each employee, get cumulative data from previous payroll_lines in same tax year
      const results: { employee: Employee; result: PayrollResult }[] = [];

      for (const emp of typedEmployees) {
        // Get cumulative totals from previous periods
        const { data: prevLines, error: prevError } = await supabase
          .from("payroll_lines")
          .select("cumulative_gross, cumulative_tax, cumulative_usc, cumulative_prsi")
          .eq("employee_id", emp.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (prevError) throw prevError;

        const prev = (prevLines && prevLines.length > 0)
          ? prevLines[0] as unknown as {
              cumulative_gross: number;
              cumulative_tax: number;
              cumulative_usc: number;
              cumulative_prsi: number;
            }
          : { cumulative_gross: 0, cumulative_tax: 0, cumulative_usc: 0, cumulative_prsi: 0 };

        const overridesForEmp = input.overrides?.[emp.id] ?? {};

        // Calculate period gross from annual salary
        const periodGross = overridesForEmp.grossPay ?? (emp.annual_salary ? Number(emp.annual_salary) / periodsPerYear : 0);

        const payrollInput: PayrollInput = {
          grossPay: Math.round(periodGross * 100) / 100,
          overtime: overridesForEmp.overtime ?? 0,
          bonus: overridesForEmp.bonus ?? 0,
          benefitInKind: overridesForEmp.benefitInKind ?? 0,
          yearlyTaxCredits: Number(emp.tax_credits_yearly),
          yearlyStandardRateCutOff: Number(emp.standard_rate_cut_off_yearly),
          uscStatus: emp.usc_status,
          prsiClass: emp.prsi_class,
          pensionEmployeePct: Number(emp.pension_employee_pct),
          pensionEmployerPct: Number(emp.pension_employer_pct),
          payFrequency: input.payFrequency,
          payPeriod: input.payPeriod,
          previousCumulativeGross: Number(prev.cumulative_gross),
          previousCumulativeTax: Number(prev.cumulative_tax),
          previousCumulativeUSC: Number(prev.cumulative_usc),
          previousCumulativePRSI: Number(prev.cumulative_prsi),
          isDirector: emp.is_director,
        };

        // 3. Calculate
        const result = calculatePayroll(payrollInput, TAX_TABLES_2026);
        results.push({ employee: emp, result });
      }

      // 4. Upsert payroll_lines
      // First delete existing lines for this run (in case of recalculation)
      const { error: deleteError } = await supabase
        .from("payroll_lines")
        .delete()
        .eq("payroll_run_id", input.runId);

      if (deleteError) throw deleteError;

      const lineInserts = results.map(({ employee, result }) => ({
        payroll_run_id: input.runId,
        employee_id: employee.id,
        gross_pay: result.grossPay,
        overtime: result.taxableGross - result.grossPay + (input.overrides?.[employee.id]?.overtime ?? 0) > 0
          ? (input.overrides?.[employee.id]?.overtime ?? 0) : 0,
        bonus: input.overrides?.[employee.id]?.bonus ?? 0,
        benefit_in_kind: input.overrides?.[employee.id]?.benefitInKind ?? 0,
        paye_tax: result.paye,
        usc: result.usc,
        employee_prsi: result.employeePrsi,
        pension_employee: result.pensionEmployee,
        other_deductions: 0,
        employer_prsi: result.employerPrsi,
        pension_employer: result.pensionEmployer,
        total_deductions: result.totalDeductions,
        net_pay: result.netPay,
        total_employer_cost: result.totalEmployerCost,
        cumulative_gross: result.cumulativeGross,
        cumulative_tax: result.cumulativeTax,
        cumulative_usc: result.cumulativeUSC,
        cumulative_prsi: result.cumulativePRSI,
      }));

      const { error: insertError } = await supabase
        .from("payroll_lines")
        .insert(lineInserts);

      if (insertError) throw insertError;

      // 5. Update run status to 'calculated'
      const { error: updateError } = await supabase
        .from("payroll_runs")
        .update({ status: "calculated", updated_at: new Date().toISOString() })
        .eq("id", input.runId);

      if (updateError) throw updateError;

      return results;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["payroll-run", variables.runId] });
      toast.success("Payroll calculated for all employees");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to calculate payroll");
    },
  });
}

export function useApprovePayrollRun() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      runId: string;
      clientUserId: string;
      taxYear: number;
      payDate: string;
      payPeriod: number;
      payFrequency: string;
    }) => {
      // 1. Fetch the payroll lines with employee data
      const { data: lines, error: linesError } = await supabase
        .from("payroll_lines")
        .select("*")
        .eq("payroll_run_id", input.runId);

      if (linesError) throw linesError;
      if (!lines || lines.length === 0) throw new Error("No payroll lines found — calculate first");

      const typedLines = lines as unknown as PayrollLine[];

      // Fetch employees
      const employeeIds = [...new Set(typedLines.map((l) => l.employee_id))];
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .in("id", employeeIds);

      if (empError) throw empError;

      const empMap = new Map<string, Employee>();
      for (const emp of (employees ?? []) as unknown as Employee[]) {
        empMap.set(emp.id, emp);
      }

      // 2. Build journal line input from payroll lines
      const journalInput = typedLines.map((line) => {
        const emp = empMap.get(line.employee_id);
        const employeeName = emp ? `${emp.first_name} ${emp.last_name}` : "Unknown";
        return {
          employeeName,
          result: {
            grossPay: Number(line.gross_pay),
            taxableGross: Number(line.gross_pay),
            paye: Number(line.paye_tax),
            usc: Number(line.usc),
            employeePrsi: Number(line.employee_prsi),
            pensionEmployee: Number(line.pension_employee),
            totalDeductions: Number(line.total_deductions),
            netPay: Number(line.net_pay),
            employerPrsi: Number(line.employer_prsi),
            pensionEmployer: Number(line.pension_employer),
            totalEmployerCost: Number(line.total_employer_cost),
          } as PayrollResult,
        };
      });

      const journalLines = generatePayrollJournalLines(journalInput);

      // 3. Create journal entry
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: input.clientUserId,
          accountant_id: user!.id,
          entry_date: input.payDate,
          description: `Payroll - Period ${input.payPeriod} (${input.payFrequency})`,
          reference: `PAY-${input.taxYear}-${String(input.payPeriod).padStart(2, "0")}`,
          entry_type: "payroll",
          tax_year: input.taxYear,
          notes: `Auto-generated from payroll run`,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const typedEntry = entry as unknown as { id: string };

      // 4. Insert journal entry lines
      const jeLines = journalLines.map((line) => ({
        journal_entry_id: typedEntry.id,
        account_name: line.accountName,
        account_type: line.accountType,
        account_code: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        description: null,
      }));

      const { error: jeLinesError } = await supabase
        .from("journal_entry_lines")
        .insert(jeLines);

      if (jeLinesError) throw jeLinesError;

      // 5. Link journal entry to payroll run and update status
      const { error: updateError } = await supabase
        .from("payroll_runs")
        .update({
          journal_entry_id: typedEntry.id,
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.runId);

      if (updateError) throw updateError;

      return entry;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["payroll-runs", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["payroll-run", variables.runId] });
      qc.invalidateQueries({ queryKey: ["client-journal-entries", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", variables.clientUserId, variables.taxYear] });
      toast.success("Payroll approved — journal entry posted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to approve payroll");
    },
  });
}

// ────────────────────────────────────────────
// Dividend Queries
// ────────────────────────────────────────────

export function useDividends(
  clientUserId: string | null | undefined,
  taxYear: number,
) {
  return useQuery({
    queryKey: ["dividends", clientUserId, taxYear],
    queryFn: async (): Promise<DividendDeclaration[]> => {
      const yearStart = `${taxYear}-01-01`;
      const yearEnd = `${taxYear}-12-31`;

      const { data, error } = await supabase
        .from("dividend_declarations")
        .select("*")
        .eq("user_id", clientUserId!)
        .gte("declaration_date", yearStart)
        .lte("declaration_date", yearEnd)
        .order("declaration_date", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DividendDeclaration[];
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });
}

// ────────────────────────────────────────────
// Dividend Mutations
// ────────────────────────────────────────────

export function useDeclareDividend() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      employee_id?: string;
      recipient_name: string;
      recipient_ppsn?: string;
      declaration_date: string;
      payment_date?: string;
      gross_amount: number;
      dwt_rate?: number;
      board_resolution_ref?: string;
      notes?: string;
      tax_year: number;
    }) => {
      // 1. Calculate dividend
      const divResult = calculateDividend({
        grossAmount: input.gross_amount,
        dwtRate: input.dwt_rate,
      });

      // 2. Calculate DWT due date
      const paymentDate = input.payment_date
        ? new Date(input.payment_date)
        : new Date(input.declaration_date);
      const dwtDueDate = getDWTDueDate(paymentDate);
      const dwtDueDateStr = dwtDueDate.toISOString().split("T")[0];

      // 3. Insert dividend declaration
      const { data: dividend, error: divError } = await supabase
        .from("dividend_declarations")
        .insert({
          user_id: input.user_id,
          created_by: user!.id,
          employee_id: input.employee_id ?? null,
          recipient_name: input.recipient_name,
          recipient_ppsn: input.recipient_ppsn ?? null,
          declaration_date: input.declaration_date,
          payment_date: input.payment_date ?? null,
          gross_amount: divResult.grossAmount,
          dwt_rate: divResult.dwtRate,
          dwt_amount: divResult.dwtAmount,
          net_amount: divResult.netAmount,
          dwt_due_date: dwtDueDateStr,
          board_resolution_ref: input.board_resolution_ref ?? null,
          notes: input.notes ?? null,
          status: "declared",
        })
        .select()
        .single();

      if (divError) throw divError;

      // 4. Generate journal entry
      const journalLines = generateDividendJournalLines(divResult, input.recipient_name);

      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: input.user_id,
          accountant_id: user!.id,
          entry_date: input.declaration_date,
          description: `Dividend declared - ${input.recipient_name}`,
          reference: `DIV-${input.tax_year}-${input.declaration_date}`,
          entry_type: "dividend",
          tax_year: input.tax_year,
          notes: `Auto-generated from dividend declaration`,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const typedEntry = entry as unknown as { id: string };

      // 5. Insert journal entry lines
      const jeLines = journalLines.map((line) => ({
        journal_entry_id: typedEntry.id,
        account_name: line.accountName,
        account_type: line.accountType,
        account_code: line.accountCode,
        debit: line.debit,
        credit: line.credit,
        description: null,
      }));

      const { error: jeLinesError } = await supabase
        .from("journal_entry_lines")
        .insert(jeLines);

      if (jeLinesError) throw jeLinesError;

      // 6. Link journal entry to dividend
      const typedDividend = dividend as unknown as { id: string };
      const { error: updateError } = await supabase
        .from("dividend_declarations")
        .update({ journal_entry_id: typedEntry.id })
        .eq("id", typedDividend.id);

      if (updateError) throw updateError;

      return dividend;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["dividends", variables.user_id, variables.tax_year] });
      qc.invalidateQueries({ queryKey: ["client-journal-entries", variables.user_id, variables.tax_year] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", variables.user_id, variables.tax_year] });
      toast.success("Dividend declared — journal entry posted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to declare dividend");
    },
  });
}

export function useMarkDividendPaid() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      tax_year: number;
      payment_date: string;
    }) => {
      const { data, error } = await supabase
        .from("dividend_declarations")
        .update({
          status: "paid",
          payment_date: input.payment_date,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["dividends", variables.user_id, variables.tax_year] });
      toast.success("Dividend marked as paid");
    },
    onError: () => {
      toast.error("Failed to update dividend");
    },
  });
}

export function useMarkDWTFiled() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      tax_year: number;
    }) => {
      const { data, error } = await supabase
        .from("dividend_declarations")
        .update({
          status: "dwt_filed",
          dwt_paid: true,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["dividends", variables.user_id, variables.tax_year] });
      toast.success("DWT marked as filed");
    },
    onError: () => {
      toast.error("Failed to update DWT status");
    },
  });
}
