import { useState } from "react";
import {
  Users,
  UserPlus,
  Pencil,
  UserX,
  Loader2,
  Shield,
  Eye,
  EyeOff,
  Download,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  useCreateEmployee,
  useUpdateEmployee,
  useDeactivateEmployee,
  type Employee,
} from "@/hooks/accountant/usePayroll";
import { generateMockRPN } from "@/lib/payroll/mockRPN";
import { toast } from "sonner";

interface EmployeeListProps {
  clientUserId: string;
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

function maskPPSN(ppsn: string): string {
  if (!ppsn || ppsn.length < 5) return ppsn;
  return "***" + ppsn.slice(-4);
}

const IRISH_COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway",
  "Kerry", "Kildare", "Kilkenny", "Laois", "Leitrim", "Limerick",
  "Longford", "Louth", "Mayo", "Meath", "Monaghan", "Offaly",
  "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
  "Wexford", "Wicklow",
];

type EmployeeFormState = {
  // Personal
  first_name: string;
  last_name: string;
  ppsn: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: "" | "male" | "female" | "other";
  job_title: string;
  // Address
  address_line1: string;
  address_line2: string;
  city: string;
  county: string;
  eircode: string;
  // Employment
  employment_start_date: string;
  employment_id: string;
  is_director: boolean;
  // Pay & Tax
  pay_type: "salaried" | "hourly";
  pay_frequency: "weekly" | "fortnightly" | "monthly";
  annual_salary: string;
  hourly_rate: string;
  normal_hours_per_week: string;
  tax_basis: "cumulative" | "week1_month1" | "emergency";
  tax_credits_yearly: string;
  standard_rate_cut_off_yearly: string;
  usc_status: "ordinary" | "reduced" | "exempt";
  prsi_class: string;
  // Previous employment (P45 for mid-year starters)
  prev_employment_gross: string;
  prev_employment_tax: string;
  prev_employment_usc: string;
  prev_employment_prsi: string;
  // Pension
  pension_employee_pct: string;
  pension_employer_pct: string;
  // Bank
  bank_iban: string;
  bank_bic: string;
  // Notes
  notes: string;
};

const defaultForm: EmployeeFormState = {
  first_name: "",
  last_name: "",
  ppsn: "",
  email: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  job_title: "",
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  eircode: "",
  employment_start_date: "",
  employment_id: "",
  is_director: false,
  pay_type: "salaried",
  pay_frequency: "monthly",
  annual_salary: "",
  hourly_rate: "",
  normal_hours_per_week: "",
  tax_basis: "cumulative",
  tax_credits_yearly: "4000",
  standard_rate_cut_off_yearly: "44000",
  usc_status: "ordinary",
  prsi_class: "A1",
  prev_employment_gross: "0",
  prev_employment_tax: "0",
  prev_employment_usc: "0",
  prev_employment_prsi: "0",
  pension_employee_pct: "0",
  pension_employer_pct: "0",
  bank_iban: "",
  bank_bic: "",
  notes: "",
};

export function EmployeeList({ clientUserId }: EmployeeListProps) {
  const { data: employees, isLoading } = useEmployees(clientUserId);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deactivateEmployee = useDeactivateEmployee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(defaultForm);
  const [revealedPPSNs, setRevealedPPSNs] = useState<Set<string>>(new Set());
  const [rpnFetched, setRpnFetched] = useState(false);
  const [fetchingRPN, setFetchingRPN] = useState(false);

  const handleFetchRPN = () => {
    const ppsn = form.ppsn.trim();
    if (!ppsn || ppsn.length < 7) {
      toast.error("Enter a valid PPSN first (e.g. 1234567AB)");
      return;
    }
    setFetchingRPN(true);
    setTimeout(() => {
      const rpn = generateMockRPN(ppsn);
      setForm((prev) => ({
        ...prev,
        tax_credits_yearly: String(rpn.taxCreditsYearly),
        standard_rate_cut_off_yearly: String(rpn.standardRateCutOffYearly),
        usc_status: rpn.uscStatus,
        prsi_class: rpn.prsiClass,
        tax_basis: "cumulative",
      }));
      setRpnFetched(true);
      setFetchingRPN(false);
      toast.success(`RPN fetched: ${rpn.rpnNumber}`, {
        description: `Tax credits: \u20AC${rpn.taxCreditsYearly.toLocaleString()} | Cut-off: \u20AC${rpn.standardRateCutOffYearly.toLocaleString()} | USC: ${rpn.uscStatus} | PRSI: ${rpn.prsiClass}`,
      });
    }, 800);
  };

  const togglePPSN = (id: string) => {
    setRevealedPPSNs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setForm(defaultForm);
    setEditingEmployee(null);
    setRpnFetched(false);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      ppsn: emp.ppsn,
      email: emp.email ?? "",
      phone: emp.phone ?? "",
      date_of_birth: emp.date_of_birth ?? "",
      gender: emp.gender ?? "",
      job_title: emp.job_title ?? "",
      address_line1: emp.address_line1 ?? "",
      address_line2: emp.address_line2 ?? "",
      city: emp.city ?? "",
      county: emp.county ?? "",
      eircode: emp.eircode ?? "",
      employment_start_date: emp.employment_start_date,
      employment_id: emp.employment_id ?? "",
      is_director: emp.is_director,
      pay_type: emp.pay_type ?? "salaried",
      pay_frequency: emp.pay_frequency,
      annual_salary: emp.annual_salary != null ? String(emp.annual_salary) : "",
      hourly_rate: emp.hourly_rate != null ? String(emp.hourly_rate) : "",
      normal_hours_per_week: emp.normal_hours_per_week != null ? String(emp.normal_hours_per_week) : "",
      tax_basis: emp.tax_basis ?? "cumulative",
      tax_credits_yearly: String(emp.tax_credits_yearly),
      standard_rate_cut_off_yearly: String(emp.standard_rate_cut_off_yearly),
      usc_status: emp.usc_status,
      prsi_class: emp.prsi_class,
      prev_employment_gross: String(emp.prev_employment_gross ?? 0),
      prev_employment_tax: String(emp.prev_employment_tax ?? 0),
      prev_employment_usc: String(emp.prev_employment_usc ?? 0),
      prev_employment_prsi: String(emp.prev_employment_prsi ?? 0),
      pension_employee_pct: String(emp.pension_employee_pct),
      pension_employer_pct: String(emp.pension_employer_pct),
      bank_iban: emp.bank_iban ?? "",
      bank_bic: emp.bank_bic ?? "",
      notes: emp.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const commonFields = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      date_of_birth: form.date_of_birth || undefined,
      gender: (form.gender || undefined) as "male" | "female" | "other" | undefined,
      job_title: form.job_title || undefined,
      address_line1: form.address_line1 || undefined,
      address_line2: form.address_line2 || undefined,
      city: form.city || undefined,
      county: form.county || undefined,
      eircode: form.eircode || undefined,
      employment_id: form.employment_id || undefined,
      is_director: form.is_director,
      pay_frequency: form.pay_frequency,
      annual_salary: form.annual_salary ? parseFloat(form.annual_salary) : undefined,
      tax_basis: form.tax_basis,
      tax_credits_yearly: parseFloat(form.tax_credits_yearly) || 4000,
      standard_rate_cut_off_yearly: parseFloat(form.standard_rate_cut_off_yearly) || 44000,
      usc_status: form.usc_status,
      prsi_class: form.prsi_class,
      pension_employee_pct: parseFloat(form.pension_employee_pct) || 0,
      pension_employer_pct: parseFloat(form.pension_employer_pct) || 0,
      bank_iban: form.bank_iban || undefined,
      bank_bic: form.bank_bic || undefined,
      notes: form.notes || undefined,
    };

    if (editingEmployee) {
      updateEmployee.mutate(
        {
          id: editingEmployee.id,
          user_id: clientUserId,
          updates: commonFields,
        },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } },
      );
    } else {
      createEmployee.mutate(
        {
          user_id: clientUserId,
          ppsn: form.ppsn,
          employment_start_date: form.employment_start_date,
          ...commonFields,
        },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } },
      );
    }
  };

  const handleDeactivate = (emp: Employee) => {
    deactivateEmployee.mutate({
      id: emp.id,
      user_id: clientUserId,
      employment_end_date: new Date().toISOString().slice(0, 10),
    });
  };

  const isSaving = createEmployee.isPending || updateEmployee.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading employees...</span>
      </div>
    );
  }

  const activeEmployees = (employees ?? []).filter((e) => e.is_active);
  const inactiveEmployees = (employees ?? []).filter((e) => !e.is_active);
  const allEmployees = [...activeEmployees, ...inactiveEmployees];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Employees &amp; Directors
          </h3>
          <p className="text-xs text-muted-foreground">
            {activeEmployees.length} active &middot; {inactiveEmployees.length} inactive
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <UserPlus className="w-3.5 h-3.5" />
          Add Employee
        </Button>
      </div>

      {/* Employees Table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {allEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No employees recorded.</p>
              <p className="text-xs mt-1">Click &quot;Add Employee&quot; to begin.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/10 border-b">
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Name</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">PPSN</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Start Date</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">PRSI Class</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Tax Basis</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Salary</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Role</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allEmployees.map((emp) => {
                    const isInactive = !emp.is_active;
                    const hasPension =
                      Number(emp.pension_employee_pct) > 0 || Number(emp.pension_employer_pct) > 0;
                    const isPPSNRevealed = revealedPPSNs.has(emp.id);

                    return (
                      <tr
                        key={emp.id}
                        className={`border-b border-muted/20 hover:bg-muted/10 transition-colors ${
                          isInactive ? "opacity-50" : ""
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {emp.first_name} {emp.last_name}
                            </span>
                            {emp.job_title && (
                              <span className="text-[10px] text-muted-foreground">{emp.job_title}</span>
                            )}
                            {hasPension && (
                              <span className="text-[10px] text-muted-foreground">
                                Pension: {emp.pension_employee_pct}%/{emp.pension_employer_pct}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {isPPSNRevealed ? emp.ppsn : maskPPSN(emp.ppsn)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              title={isPPSNRevealed ? "Hide PPSN" : "Reveal PPSN"}
                              onClick={() => togglePPSN(emp.id)}
                            >
                              {isPPSNRevealed ? (
                                <EyeOff className="w-3 h-3 text-muted-foreground" />
                              ) : (
                                <Eye className="w-3 h-3 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">
                          {formatDate(emp.employment_start_date)}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {emp.prsi_class}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              emp.tax_basis === "emergency"
                                ? "border-red-200 text-red-600"
                                : emp.tax_basis === "week1_month1"
                                  ? "border-amber-200 text-amber-600"
                                  : ""
                            }`}
                          >
                            {emp.tax_basis === "week1_month1" ? "Wk1/Mth1" : emp.tax_basis === "emergency" ? "Emergency" : "Cumulative"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-sm">
                          {emp.annual_salary ? eur(Number(emp.annual_salary)) : "\u2014"}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {emp.is_director ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"
                            >
                              <Shield className="w-2.5 h-2.5 mr-0.5" />
                              Director
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-gray-100 text-gray-600 border-gray-200"
                            >
                              Employee
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isInactive ? (
                            <Badge variant="secondary" className="text-[10px] bg-gray-100 text-gray-500">
                              Inactive
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700">
                              Active
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              title="Edit employee"
                              onClick={() => openEdit(emp)}
                            >
                              <Pencil className="w-3 h-3 text-muted-foreground hover:text-blue-500" />
                            </Button>
                            {!isInactive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                title="Deactivate employee"
                                onClick={() => handleDeactivate(emp)}
                              >
                                <UserX className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              {editingEmployee ? "Edit Employee" : "Add Employee"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* ── Personal Details ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Personal Details
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Jamie"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Fitzgerald"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">PPSN *</Label>
                <div className="flex gap-1.5">
                  <Input
                    value={form.ppsn}
                    onChange={(e) => { setForm({ ...form, ppsn: e.target.value }); setRpnFetched(false); }}
                    placeholder="1234567AB"
                    className="h-8 font-mono flex-1"
                    disabled={!!editingEmployee}
                  />
                  {!editingEmployee && (
                    <Button
                      type="button"
                      variant={rpnFetched ? "outline" : "secondary"}
                      size="sm"
                      className={`h-8 px-2.5 gap-1 text-xs whitespace-nowrap ${rpnFetched ? "border-emerald-300 text-emerald-700 bg-emerald-50" : ""}`}
                      onClick={handleFetchRPN}
                      disabled={fetchingRPN || !form.ppsn.trim()}
                    >
                      {fetchingRPN ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : rpnFetched ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {fetchingRPN ? "Fetching..." : rpnFetched ? "RPN OK" : "Fetch RPN"}
                    </Button>
                  )}
                </div>
                {!editingEmployee && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Fetch Revenue Payroll Notification to auto-fill tax details
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Birth</Label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Gender</Label>
                <Select
                  value={form.gender}
                  onValueChange={(v) => setForm({ ...form, gender: v as "male" | "female" | "other" })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jamie@example.com"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="087 123 4567"
                  className="h-8"
                />
              </div>
            </div>

            {/* ── Address ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Address
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 1</Label>
                <Input
                  value={form.address_line1}
                  onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                  placeholder="12 Main Street"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 2</Label>
                <Input
                  value={form.address_line2}
                  onChange={(e) => setForm({ ...form, address_line2: e.target.value })}
                  placeholder="Apt 4"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">City / Town</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Dublin"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">County</Label>
                <Select value={form.county} onValueChange={(v) => setForm({ ...form, county: v })}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select county" />
                  </SelectTrigger>
                  <SelectContent>
                    {IRISH_COUNTIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Eircode</Label>
                <Input
                  value={form.eircode}
                  onChange={(e) => setForm({ ...form, eircode: e.target.value.toUpperCase() })}
                  placeholder="D02 XY45"
                  className="h-8 font-mono"
                  maxLength={8}
                />
              </div>
            </div>

            {/* ── Employment ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Employment
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={form.employment_start_date}
                  onChange={(e) => setForm({ ...form, employment_start_date: e.target.value })}
                  className="h-8"
                  disabled={!!editingEmployee}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Job Title</Label>
                <Input
                  value={form.job_title}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  placeholder="Carpenter"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Revenue Employment ID</Label>
                <Input
                  value={form.employment_id}
                  onChange={(e) => setForm({ ...form, employment_id: e.target.value })}
                  placeholder="e.g. 1"
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={form.is_director}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, is_director: checked === true })
                  }
                />
                <span className="text-sm">Is Director</span>
              </label>
            </div>

            {/* ── Pay & Tax ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Pay &amp; Tax
                {rpnFetched && (
                  <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200 font-normal normal-case">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                    Auto-filled from RPN
                  </Badge>
                )}
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pay Frequency</Label>
                <Select
                  value={form.pay_frequency}
                  onValueChange={(v) =>
                    setForm({ ...form, pay_frequency: v as "weekly" | "fortnightly" | "monthly" })
                  }
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
              <div className="space-y-1.5">
                <Label className="text-xs">Annual Salary</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.annual_salary}
                  onChange={(e) => setForm({ ...form, annual_salary: e.target.value })}
                  placeholder="60000.00"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Basis</Label>
                <Select
                  value={form.tax_basis}
                  onValueChange={(v) =>
                    setForm({ ...form, tax_basis: v as "cumulative" | "week1_month1" | "emergency" })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cumulative">Cumulative</SelectItem>
                    <SelectItem value="week1_month1">Week 1 / Month 1</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Credits (yearly)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.tax_credits_yearly}
                  onChange={(e) => setForm({ ...form, tax_credits_yearly: e.target.value })}
                  placeholder="4000"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Standard Rate Cut-Off (yearly)</Label>
                <Input
                  type="number"
                  step="1"
                  value={form.standard_rate_cut_off_yearly}
                  onChange={(e) => setForm({ ...form, standard_rate_cut_off_yearly: e.target.value })}
                  placeholder="44000"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">USC Status</Label>
                <Select
                  value={form.usc_status}
                  onValueChange={(v) =>
                    setForm({ ...form, usc_status: v as "ordinary" | "reduced" | "exempt" })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinary">Ordinary</SelectItem>
                    <SelectItem value="reduced">Reduced</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PRSI Class</Label>
                <Select
                  value={form.prsi_class}
                  onValueChange={(v) => setForm({ ...form, prsi_class: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1 (most PAYE employees)</SelectItem>
                    <SelectItem value="A2">A2</SelectItem>
                    <SelectItem value="A8">A8</SelectItem>
                    <SelectItem value="B">B (civil servants pre-1995)</SelectItem>
                    <SelectItem value="C">C (officers of state)</SelectItem>
                    <SelectItem value="D">D (permanent defence forces)</SelectItem>
                    <SelectItem value="S">S (self-employed)</SelectItem>
                    <SelectItem value="J1">J1 (subsidiary employment)</SelectItem>
                    <SelectItem value="K">K (public office holders)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Pension ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pension
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employee Contribution %</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.pension_employee_pct}
                  onChange={(e) => setForm({ ...form, pension_employee_pct: e.target.value })}
                  placeholder="0"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Employer Contribution %</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.pension_employer_pct}
                  onChange={(e) => setForm({ ...form, pension_employer_pct: e.target.value })}
                  placeholder="0"
                  className="h-8"
                />
              </div>
            </div>

            {/* ── Bank Details ── */}
            <div className="px-4 py-3 bg-muted/30 border-b -mx-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Bank Details
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">IBAN</Label>
                <Input
                  value={form.bank_iban}
                  onChange={(e) => setForm({ ...form, bank_iban: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  placeholder="IE29AIBK93115212345678"
                  className="h-8 font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">BIC</Label>
                <Input
                  value={form.bank_bic}
                  onChange={(e) => setForm({ ...form, bank_bic: e.target.value.toUpperCase() })}
                  placeholder="AIBKIE2D"
                  className="h-8 font-mono"
                  maxLength={11}
                />
              </div>
            </div>

            {/* ── Notes ── */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full h-16 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!form.first_name || !form.last_name || !form.ppsn || !form.employment_start_date || isSaving}
            >
              {isSaving ? "Saving..." : editingEmployee ? "Update Employee" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
