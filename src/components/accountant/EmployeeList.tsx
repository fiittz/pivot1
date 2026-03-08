import { useState } from "react";
import {
  Users,
  UserPlus,
  Pencil,
  UserX,
  Loader2,
  Shield,
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

type EmployeeFormState = {
  first_name: string;
  last_name: string;
  ppsn: string;
  email: string;
  employment_start_date: string;
  is_director: boolean;
  pay_frequency: "weekly" | "fortnightly" | "monthly";
  annual_salary: string;
  tax_credits_yearly: string;
  standard_rate_cut_off_yearly: string;
  usc_status: "ordinary" | "reduced" | "exempt";
  prsi_class: string;
  pension_employee_pct: string;
  pension_employer_pct: string;
  notes: string;
};

const defaultForm: EmployeeFormState = {
  first_name: "",
  last_name: "",
  ppsn: "",
  email: "",
  employment_start_date: "",
  is_director: false,
  pay_frequency: "monthly",
  annual_salary: "",
  tax_credits_yearly: "4000",
  standard_rate_cut_off_yearly: "44000",
  usc_status: "ordinary",
  prsi_class: "A1",
  pension_employee_pct: "0",
  pension_employer_pct: "0",
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

  const resetForm = () => {
    setForm(defaultForm);
    setEditingEmployee(null);
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
      employment_start_date: emp.employment_start_date,
      is_director: emp.is_director,
      pay_frequency: emp.pay_frequency,
      annual_salary: emp.annual_salary != null ? String(emp.annual_salary) : "",
      tax_credits_yearly: String(emp.tax_credits_yearly),
      standard_rate_cut_off_yearly: String(emp.standard_rate_cut_off_yearly),
      usc_status: emp.usc_status,
      prsi_class: emp.prsi_class,
      pension_employee_pct: String(emp.pension_employee_pct),
      pension_employer_pct: String(emp.pension_employer_pct),
      notes: emp.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingEmployee) {
      updateEmployee.mutate(
        {
          id: editingEmployee.id,
          user_id: clientUserId,
          updates: {
            first_name: form.first_name,
            last_name: form.last_name,
            email: form.email || undefined,
            is_director: form.is_director,
            pay_frequency: form.pay_frequency,
            annual_salary: form.annual_salary ? parseFloat(form.annual_salary) : undefined,
            tax_credits_yearly: parseFloat(form.tax_credits_yearly) || 4000,
            standard_rate_cut_off_yearly: parseFloat(form.standard_rate_cut_off_yearly) || 44000,
            usc_status: form.usc_status,
            prsi_class: form.prsi_class,
            pension_employee_pct: parseFloat(form.pension_employee_pct) || 0,
            pension_employer_pct: parseFloat(form.pension_employer_pct) || 0,
            notes: form.notes || undefined,
          },
        },
        { onSuccess: () => { setDialogOpen(false); resetForm(); } },
      );
    } else {
      createEmployee.mutate(
        {
          user_id: clientUserId,
          first_name: form.first_name,
          last_name: form.last_name,
          ppsn: form.ppsn,
          email: form.email || undefined,
          employment_start_date: form.employment_start_date,
          is_director: form.is_director,
          pay_frequency: form.pay_frequency,
          annual_salary: form.annual_salary ? parseFloat(form.annual_salary) : undefined,
          tax_credits_yearly: parseFloat(form.tax_credits_yearly) || 4000,
          standard_rate_cut_off_yearly: parseFloat(form.standard_rate_cut_off_yearly) || 44000,
          usc_status: form.usc_status,
          prsi_class: form.prsi_class,
          pension_employee_pct: parseFloat(form.pension_employee_pct) || 0,
          pension_employer_pct: parseFloat(form.pension_employer_pct) || 0,
          notes: form.notes || undefined,
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
            <div className="text-center py-12 text-muted-foreground text-sm">
              No employees recorded. Click &quot;Add Employee&quot; to begin.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">PPSN</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Start Date</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">PRSI Class</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Salary</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Role</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allEmployees.map((emp) => {
                  const isInactive = !emp.is_active;
                  const hasPension =
                    Number(emp.pension_employee_pct) > 0 || Number(emp.pension_employer_pct) > 0;

                  return (
                    <tr
                      key={emp.id}
                      className={`border-b border-muted/20 hover:bg-muted/10 transition-colors ${
                        isInactive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">
                            {emp.first_name} {emp.last_name}
                          </span>
                          {hasPension && (
                            <span className="text-[10px] text-muted-foreground">
                              (Pension: {emp.pension_employee_pct}%/{emp.pension_employer_pct}%)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">
                        {maskPPSN(emp.ppsn)}
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {formatDate(emp.employment_start_date)}
                      </td>
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className="text-[10px]">
                          {emp.prsi_class}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                        {emp.annual_salary ? eur(Number(emp.annual_salary)) : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {emp.is_director ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-amber-100 text-amber-700 border-amber-200"
                          >
                            <Shield className="w-2.5 h-2.5 mr-0.5" />
                            Director
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"
                          >
                            Employee
                          </Badge>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-center">
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
                      <td className="py-1.5 px-3 text-right">
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
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">First Name</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder="Jamie"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Name</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  placeholder="Fitzgerald"
                  className="h-8"
                />
              </div>
            </div>

            {/* PPSN + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">PPSN</Label>
                <Input
                  value={form.ppsn}
                  onChange={(e) => setForm({ ...form, ppsn: e.target.value })}
                  placeholder="1234567AB"
                  className="h-8 font-mono"
                  disabled={!!editingEmployee}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email (optional)</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="jamie@example.com"
                  className="h-8"
                />
              </div>
            </div>

            {/* Start date + Director */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employment Start Date</Label>
                <Input
                  type="date"
                  value={form.employment_start_date}
                  onChange={(e) => setForm({ ...form, employment_start_date: e.target.value })}
                  className="h-8"
                  disabled={!!editingEmployee}
                />
              </div>
              <div className="flex items-end pb-1">
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
            </div>

            {/* Pay frequency + salary */}
            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs">Annual Salary (optional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.annual_salary}
                  onChange={(e) => setForm({ ...form, annual_salary: e.target.value })}
                  placeholder="60000.00"
                  className="h-8"
                />
              </div>
            </div>

            {/* Tax credits + standard rate cutoff */}
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

            {/* USC + PRSI */}
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
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="A8">A8</SelectItem>
                    <SelectItem value="S">S (Self-employed)</SelectItem>
                    <SelectItem value="J1">J1</SelectItem>
                    <SelectItem value="M">M (No contribution)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pension */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pension Employee %</Label>
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
                <Label className="text-xs">Pension Employer %</Label>
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

            {/* Notes */}
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
