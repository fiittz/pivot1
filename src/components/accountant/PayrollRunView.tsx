import { useState, useMemo, Fragment } from "react";
import {
  Calculator,
  CheckCircle2,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useEmployees,
  usePayrollRuns,
  usePayrollRun,
  useCreatePayrollRun,
  useCalculatePayrollRun,
  useApprovePayrollRun,
  type PayrollRun,
  type PayrollLine,
  type Employee,
} from "@/hooks/accountant/usePayroll";

interface PayrollRunViewProps {
  clientUserId: string;
  taxYear: number;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

type PayFrequency = "weekly" | "fortnightly" | "monthly";
type PayRunStatus = "draft" | "calculated" | "approved" | "submitted" | "accepted";

const STATUS_CONFIG: Record<PayRunStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200" },
  calculated: { label: "Calculated", color: "bg-blue-100 text-blue-700 border-blue-200" },
  approved: { label: "Approved", color: "bg-green-100 text-green-700 border-green-200" },
  submitted: { label: "Submitted", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  accepted: { label: "Accepted", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const PERIODS_PER_FREQ: Record<PayFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
};

function getPeriodLabel(period: number, frequency: string): string {
  if (frequency === "monthly") {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    return months[period - 1] ?? `Period ${period}`;
  }
  return `Period ${period}`;
}

type EmployeePayInput = {
  employee_id: string;
  employee_name: string;
  gross_pay: string;
  overtime: string;
  bonus: string;
};

export function PayrollRunView({ clientUserId, taxYear }: PayrollRunViewProps) {
  const { data: employees } = useEmployees(clientUserId);
  const { data: payrollRuns, isLoading } = usePayrollRuns(clientUserId, taxYear);
  const createRun = useCreatePayrollRun();
  const calculateRun = useCalculatePayrollRun();
  const approveRun = useApprovePayrollRun();

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [payslipLine, setPayslipLine] = useState<(PayrollLine & { employee?: Employee }) | null>(null);
  const [newRunOpen, setNewRunOpen] = useState(false);

  // Fetch the expanded run's full data (with lines)
  const { data: expandedRunData } = usePayrollRun(expandedRunId);

  // New run form
  const [newRunForm, setNewRunForm] = useState({
    pay_period: "",
    pay_date: "",
    pay_frequency: "monthly" as PayFrequency,
  });
  const [employeeInputs, setEmployeeInputs] = useState<EmployeePayInput[]>([]);

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.is_active),
    [employees],
  );

  const nextPeriod = useMemo(() => {
    if (!payrollRuns || payrollRuns.length === 0) return 1;
    const maxPeriod = Math.max(...payrollRuns.map((r) => r.pay_period));
    return maxPeriod + 1;
  }, [payrollRuns]);

  const openNewRun = () => {
    const freq: PayFrequency = "monthly";
    const periods = PERIODS_PER_FREQ[freq];
    setNewRunForm({
      pay_period: nextPeriod.toString(),
      pay_date: "",
      pay_frequency: freq,
    });
    setEmployeeInputs(
      activeEmployees.map((emp) => ({
        employee_id: emp.id,
        employee_name: `${emp.first_name} ${emp.last_name}`,
        gross_pay: emp.annual_salary
          ? (Number(emp.annual_salary) / periods).toFixed(2)
          : "",
        overtime: "0",
        bonus: "0",
      })),
    );
    setNewRunOpen(true);
  };

  const updateEmployeeInput = (idx: number, field: keyof EmployeePayInput, value: string) => {
    setEmployeeInputs((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleFrequencyChange = (freq: PayFrequency) => {
    setNewRunForm((prev) => ({ ...prev, pay_frequency: freq }));
    const periods = PERIODS_PER_FREQ[freq];
    setEmployeeInputs((prev) =>
      prev.map((inp) => {
        const emp = activeEmployees.find((e) => e.id === inp.employee_id);
        return {
          ...inp,
          gross_pay: emp?.annual_salary
            ? (Number(emp.annual_salary) / periods).toFixed(2)
            : inp.gross_pay,
        };
      }),
    );
  };

  const handleCreateRun = () => {
    createRun.mutate(
      {
        user_id: clientUserId,
        tax_year: taxYear,
        pay_period: parseInt(newRunForm.pay_period),
        pay_date: newRunForm.pay_date,
        pay_frequency: newRunForm.pay_frequency,
      },
      { onSuccess: () => setNewRunOpen(false) },
    );
  };

  const handleCalculate = (run: PayrollRun) => {
    // Build overrides from employee inputs (if we stored them -- for now use defaults)
    calculateRun.mutate({
      runId: run.id,
      clientUserId,
      taxYear,
      payPeriod: run.pay_period,
      payFrequency: run.pay_frequency as PayFrequency,
    });
  };

  const handleApprove = (run: PayrollRun) => {
    approveRun.mutate({
      runId: run.id,
      clientUserId,
      taxYear,
      payDate: run.pay_date,
      payPeriod: run.pay_period,
      payFrequency: run.pay_frequency,
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedRunId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading payroll runs...</span>
      </div>
    );
  }

  const runs = payrollRuns ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Payroll &mdash; {taxYear}
          </h3>
          <p className="text-xs text-muted-foreground">
            {runs.length} pay run{runs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openNewRun} disabled={activeEmployees.length === 0}>
          <Plus className="w-3.5 h-3.5" />
          New Pay Run
        </Button>
      </div>

      {/* Pay runs table */}
      {runs.length === 0 ? (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Receipt className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No pay runs for {taxYear}.</p>
            <p className="text-xs mt-1">Click &quot;New Pay Run&quot; to start.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/10 border-b">
                    <th className="w-8 py-2 px-2"></th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Period</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Pay Date</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    const isExpanded = expandedRunId === run.id;
                    const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.draft;
                    const freq = run.pay_frequency as PayFrequency;
                    const lines = isExpanded && expandedRunData ? expandedRunData.lines : [];

                    return (
                      <Fragment key={run.id}>
                        <tr
                          className="border-b border-muted/20 hover:bg-muted/10 cursor-pointer transition-colors"
                          onClick={() => toggleExpand(run.id)}
                        >
                          <td className="py-2 px-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-2 px-3 text-sm font-medium">
                            {getPeriodLabel(run.pay_period, run.pay_frequency)}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({run.pay_period}/{PERIODS_PER_FREQ[freq] ?? "?"})
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">
                            {formatDate(run.pay_date)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                              {statusCfg.label}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {run.status === "draft" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  onClick={() => handleCalculate(run)}
                                  disabled={calculateRun.isPending}
                                >
                                  <Calculator className="w-3 h-3" />
                                  Calculate
                                </Button>
                              )}
                              {run.status === "calculated" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                                  onClick={() => handleApprove(run)}
                                  disabled={approveRun.isPending}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Approve &amp; Post
                                </Button>
                              )}
                              {(run.status === "approved" || run.status === "submitted") && run.journal_entry_id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs gap-1"
                                  title="View linked journal entry"
                                >
                                  <FileText className="w-3 h-3" />
                                  Journal
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded detail with lines */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="p-0">
                              <div className="bg-muted/20 border-t border-muted/30">
                                {/* Section header */}
                                <div className="px-4 py-3 bg-muted/30 border-b">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Employee Breakdown
                                  </h4>
                                </div>
                                {lines.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-6">
                                    {run.status === "draft"
                                      ? "Click \"Calculate\" to compute payroll for all employees."
                                      : "Loading lines..."}
                                  </p>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-muted/10 border-b">
                                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Employee</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Gross</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">PAYE</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">USC</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ee PRSI</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pension</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net Pay</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Er PRSI</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Er Pension</th>
                                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total Cost</th>
                                          <th className="w-8"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {lines.map((line) => {
                                          const empName = line.employee
                                            ? `${line.employee.first_name} ${line.employee.last_name}`
                                            : "Unknown";
                                          return (
                                            <tr key={line.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                                              <td className="py-2 px-3 font-medium">{empName}</td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums">
                                                {eur(Number(line.gross_pay))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                                {eur(Number(line.paye_tax))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                                {eur(Number(line.usc))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                                {eur(Number(line.employee_prsi))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                                {eur(Number(line.pension_employee))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                                                {eur(Number(line.net_pay))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                                {eur(Number(line.employer_prsi))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums text-muted-foreground">
                                                {eur(Number(line.pension_employer))}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">
                                                {eur(Number(line.total_employer_cost))}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {run.status !== "draft" && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 w-5 p-0"
                                                    title="View payslip"
                                                    onClick={() => setPayslipLine(line)}
                                                  >
                                                    <Receipt className="w-3 h-3 text-muted-foreground hover:text-blue-500" />
                                                  </Button>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        {/* Totals row */}
                                        {lines.length > 1 && (
                                          <tr className="border-t-2 border-foreground/20 font-semibold bg-muted/10">
                                            <td className="py-2 px-3">TOTALS</td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                                              {eur(lines.reduce((s, l) => s + Number(l.gross_pay), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                              {eur(lines.reduce((s, l) => s + Number(l.paye_tax), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                              {eur(lines.reduce((s, l) => s + Number(l.usc), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                              {eur(lines.reduce((s, l) => s + Number(l.employee_prsi), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">
                                              {eur(lines.reduce((s, l) => s + Number(l.pension_employee), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                                              {eur(lines.reduce((s, l) => s + Number(l.net_pay), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                                              {eur(lines.reduce((s, l) => s + Number(l.employer_prsi), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                                              {eur(lines.reduce((s, l) => s + Number(l.pension_employer), 0))}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono tabular-nums">
                                              {eur(lines.reduce((s, l) => s + Number(l.total_employer_cost), 0))}
                                            </td>
                                            <td></td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Pay Run Dialog */}
      <Dialog open={newRunOpen} onOpenChange={setNewRunOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Pay Run
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pay Period</Label>
                <Input
                  type="number"
                  value={newRunForm.pay_period}
                  onChange={(e) => setNewRunForm({ ...newRunForm, pay_period: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pay Date</Label>
                <Input
                  type="date"
                  value={newRunForm.pay_date}
                  onChange={(e) => setNewRunForm({ ...newRunForm, pay_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Frequency</Label>
                <Select
                  value={newRunForm.pay_frequency}
                  onValueChange={(v) => handleFrequencyChange(v as PayFrequency)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Per-employee gross pay preview */}
            {activeEmployees.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Expected Gross Pay (per employee)
                </Label>
                <div className="space-y-1">
                  {employeeInputs.map((inp) => (
                    <div key={inp.employee_id} className="flex justify-between items-center text-sm px-3 py-1.5 bg-muted/10 rounded-lg border border-muted/20">
                      <span className="font-medium">{inp.employee_name}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {inp.gross_pay ? eur(parseFloat(inp.gross_pay)) : "\u2014"}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Gross pay will be computed from annual salary / periods. Override individual amounts after creating the run using the Calculate step.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewRunOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateRun}
              disabled={
                !newRunForm.pay_period ||
                !newRunForm.pay_date ||
                createRun.isPending
              }
            >
              {createRun.isPending ? "Creating..." : "Create Pay Run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payslip Dialog */}
      <Dialog open={!!payslipLine} onOpenChange={() => setPayslipLine(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Payslip
            </DialogTitle>
          </DialogHeader>
          {payslipLine && <PayslipCard line={payslipLine} />}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPayslipLine(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Payslip Card ---------- */

function PayslipCard({ line }: { line: PayrollLine & { employee?: Employee } }) {
  const empName = line.employee
    ? `${line.employee.first_name} ${line.employee.last_name}`
    : "Employee";

  const grossPay = Number(line.gross_pay);
  const overtime = Number(line.overtime);
  const bonus = Number(line.bonus);
  const basicPay = grossPay - overtime - bonus;

  const payeTax = Number(line.paye_tax);
  const usc = Number(line.usc);
  const eePrsi = Number(line.employee_prsi);
  const eePension = Number(line.pension_employee);
  const totalDeductions = Number(line.total_deductions);
  const netPay = Number(line.net_pay);

  const erPrsi = Number(line.employer_prsi);
  const erPension = Number(line.pension_employer);
  const totalCost = Number(line.total_employer_cost);

  return (
    <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-4 py-3 bg-muted/30 border-b">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payslip</p>
          <p className="font-semibold text-base mt-0.5">{empName}</p>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {/* Earnings */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Earnings
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Basic Pay</span>
                <span className="font-mono tabular-nums">{eur(basicPay)}</span>
              </div>
              {overtime > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Overtime</span>
                  <span className="font-mono tabular-nums">{eur(overtime)}</span>
                </div>
              )}
              {bonus > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Bonus</span>
                  <span className="font-mono tabular-nums">{eur(bonus)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Gross Pay</span>
                <span className="font-mono tabular-nums">{eur(grossPay)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Deductions
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>PAYE Income Tax</span>
                <span className="font-mono tabular-nums text-red-600">{eur(payeTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>USC</span>
                <span className="font-mono tabular-nums text-red-600">{eur(usc)}</span>
              </div>
              <div className="flex justify-between">
                <span>Employee PRSI</span>
                <span className="font-mono tabular-nums text-red-600">{eur(eePrsi)}</span>
              </div>
              {eePension > 0 && (
                <div className="flex justify-between">
                  <span>Pension</span>
                  <span className="font-mono tabular-nums text-red-600">{eur(eePension)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Total Deductions</span>
                <span className="font-mono tabular-nums text-red-600">{eur(totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-4 py-3">
            <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-400">
              <span>NET PAY</span>
              <span className="font-mono tabular-nums text-lg">{eur(netPay)}</span>
            </div>
          </div>

          {/* Employer Costs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Employer Costs
            </p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Employer PRSI</span>
                <span className="font-mono tabular-nums">{eur(erPrsi)}</span>
              </div>
              {erPension > 0 && (
                <div className="flex justify-between">
                  <span>Employer Pension</span>
                  <span className="font-mono tabular-nums">{eur(erPension)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Total Cost to Company</span>
                <span className="font-mono tabular-nums">{eur(totalCost)}</span>
              </div>
            </div>
          </div>

          {/* Cumulative */}
          {(Number(line.cumulative_gross) > 0 || Number(line.cumulative_tax) > 0) && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Cumulative (Year to Date)
              </p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Gross</p>
                  <p className="font-mono tabular-nums font-medium">{eur(Number(line.cumulative_gross))}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Tax</p>
                  <p className="font-mono tabular-nums font-medium">{eur(Number(line.cumulative_tax))}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">USC</p>
                  <p className="font-mono tabular-nums font-medium">{eur(Number(line.cumulative_usc))}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
