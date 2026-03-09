import { useState } from "react";
import {
  Users,
  Shield,
  AlertTriangle,
  Download,
  Send,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useAutoEnrolmentSummary,
  useAutoEnrolmentEmployees,
  useContributionSummary,
  useAEPNInfo,
  useEnrolEmployee,
  useSuspendEmployee,
  useReEnrolEmployee,
  useDownloadAEPNs,
  useSubmitContributions,
  getContributionRates,
  type EnrolmentStatus,
  type AutoEnrolmentEmployee,
} from "@/hooks/accountant/useAutoEnrolment";

// -- Helpers --

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(n);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "\u2014";
  }
}

const STATUS_CONFIG: Record<
  EnrolmentStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  enrolled: { label: "Enrolled", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  pending: { label: "Pending", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600 text-black" },
  opted_out: { label: "Opted Out", variant: "default", className: "bg-amber-500 hover:bg-amber-600" },
  suspended: { label: "Suspended", variant: "default", className: "bg-blue-500 hover:bg-blue-600" },
  exempt: { label: "Exempt", variant: "secondary", className: "" },
  ineligible: { label: "Ineligible", variant: "secondary", className: "" },
};

// -- Props --

interface AutoEnrolmentPanelProps {
  clientUserId: string;
  taxYear: number;
}

// -- Component --

export function AutoEnrolmentPanel({
  clientUserId,
  taxYear,
}: AutoEnrolmentPanelProps) {
  const [reviewEmployee, setReviewEmployee] =
    useState<AutoEnrolmentEmployee | null>(null);

  const {
    data: summary,
    isLoading: summaryLoading,
  } = useAutoEnrolmentSummary(clientUserId, taxYear);
  const {
    data: employees,
    isLoading: employeesLoading,
  } = useAutoEnrolmentEmployees(clientUserId, taxYear);
  const {
    data: contributions,
    isLoading: contributionsLoading,
  } = useContributionSummary(clientUserId, taxYear);
  const {
    data: aepnInfo,
    isLoading: aepnLoading,
  } = useAEPNInfo(clientUserId);

  const enrolMutation = useEnrolEmployee(clientUserId, taxYear);
  const suspendMutation = useSuspendEmployee(clientUserId, taxYear);
  const reEnrolMutation = useReEnrolEmployee(clientUserId, taxYear);
  const downloadAEPNsMutation = useDownloadAEPNs(clientUserId);
  const submitMutation = useSubmitContributions(clientUserId, taxYear);

  const rates = getContributionRates(taxYear);
  const isLoading =
    summaryLoading || employeesLoading || contributionsLoading || aepnLoading;

  // -- Action handlers --

  function handleEnrol(employeeId: string) {
    enrolMutation.mutate(employeeId, {
      onSuccess: () => toast.success("Employee enrolled successfully"),
      onError: (err) =>
        toast.error(`Failed to enrol: ${(err as Error).message}`),
    });
  }

  function handleSuspend(employeeId: string) {
    suspendMutation.mutate(employeeId, {
      onSuccess: () => toast.success("Enrolment suspended"),
      onError: (err) =>
        toast.error(`Failed to suspend: ${(err as Error).message}`),
    });
  }

  function handleReEnrol(employeeId: string) {
    reEnrolMutation.mutate(employeeId, {
      onSuccess: () => toast.success("Employee re-enrolled"),
      onError: (err) =>
        toast.error(`Failed to re-enrol: ${(err as Error).message}`),
    });
  }

  function handleDownloadAEPNs() {
    downloadAEPNsMutation.mutate(undefined, {
      onSuccess: () => toast.success("AEPNs downloaded from NAERSA"),
      onError: (err) =>
        toast.error(`Download failed: ${(err as Error).message}`),
    });
  }

  function handleSubmitContributions() {
    submitMutation.mutate(undefined, {
      onSuccess: () =>
        toast.success("Contributions submitted to NAERSA"),
      onError: (err) =>
        toast.error(`Submission failed: ${(err as Error).message}`),
    });
  }

  // -- Loading state --

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading auto-enrolment data...
        </span>
      </div>
    );
  }

  // -- Empty state --

  if (!employees || employees.length === 0) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">
            No employees found for auto-enrolment in {taxYear}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add employees via the Employees tab to begin.
          </p>
        </CardContent>
      </Card>
    );
  }

  // -- Render --

  return (
    <div className="space-y-4">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Enrolled</p>
            <p className="text-2xl font-bold text-green-600 tabular-nums">
              {summary?.enrolled ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Employee Contributions</p>
            <p className="text-xl font-bold font-mono tabular-nums">
              {eur(contributions?.total_employee ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Employer Contributions</p>
            <p className="text-xl font-bold font-mono tabular-nums">
              {eur(contributions?.total_employer ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-amber-600">Pending Enrolments</p>
            <p className="text-2xl font-bold text-amber-600 tabular-nums">
              {(summary?.total_eligible ?? 0) - (summary?.enrolled ?? 0) - (summary?.opted_out ?? 0) - (summary?.exempt ?? 0) - (summary?.ineligible ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rate Display */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Current Phase Rates ({taxYear})
          </h4>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Employee</p>
              <p className="text-2xl font-bold tabular-nums">{rates.employee}%</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Employer</p>
              <p className="text-2xl font-bold tabular-nums">{rates.employer}%</p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">State Top-Up</p>
              <p className="text-2xl font-bold tabular-nums">{rates.state}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Employee Enrolment Table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Employee Enrolment
          </h4>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/10 border-b">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Age</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                    Annual Gross
                  </th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                    Enrolled Date
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                    Opt-Out Window
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const cfg = STATUS_CONFIG[emp.status];
                  const pastReEnrolDate =
                    emp.re_enrolment_date &&
                    new Date(emp.re_enrolment_date) <= new Date();

                  return (
                    <tr key={emp.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2 font-medium">{emp.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{emp.age}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {eur(emp.annual_gross)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={cfg.variant} className={`text-[10px] ${cfg.className}`}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(emp.enrolled_date)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatDate(emp.opt_out_window_end)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <EmployeeActions
                          employee={emp}
                          pastReEnrolDate={!!pastReEnrolDate}
                          onEnrol={handleEnrol}
                          onSuspend={handleSuspend}
                          onReEnrol={handleReEnrol}
                          onReview={setReviewEmployee}
                          enrolLoading={enrolMutation.isPending}
                          suspendLoading={suspendMutation.isPending}
                          reEnrolLoading={reEnrolMutation.isPending}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. AEPN Section */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Auto-Enrolment Personal Notifications (AEPNs)
          </h4>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm">
                Last download:{" "}
                <span className="font-medium">
                  {formatDate(aepnInfo?.last_download ?? null)}
                </span>
              </p>
              {(aepnInfo?.new_count ?? 0) > 0 && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {aepnInfo!.new_count} new notification
                  {aepnInfo!.new_count > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAEPNs}
              disabled={downloadAEPNsMutation.isPending}
              className="gap-1.5"
            >
              {downloadAEPNsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download AEPNs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. Contribution Summary */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
          <Send className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contribution Summary
          </h4>
          {contributions?.period_label && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({contributions.period_label})
            </span>
          )}
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                Employee Contributions
              </p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {eur(contributions?.total_employee ?? 0)}
              </p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                Employer Contributions
              </p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {eur(contributions?.total_employer ?? 0)}
              </p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">State Top-Up</p>
              <p className="text-lg font-bold font-mono tabular-nums">
                {eur(contributions?.total_state_topup ?? 0)}
              </p>
            </div>
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <div className="mt-1">
                <ContributionStatusBadge
                  status={contributions?.submission_status ?? "pending"}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {contributions?.submitted_at
                ? `Last submitted: ${formatDate(contributions.submitted_at)}`
                : "Not yet submitted for this period"}
            </p>
            <Button
              size="sm"
              onClick={handleSubmitContributions}
              disabled={
                submitMutation.isPending ||
                contributions?.submission_status === "submitted" ||
                contributions?.submission_status === "accepted"
              }
              className="gap-1.5"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Submit to NAERSA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={!!reviewEmployee}
        onOpenChange={(open) => {
          if (!open) setReviewEmployee(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Exemption</DialogTitle>
          </DialogHeader>
          {reviewEmployee && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Employee:</span>{" "}
                {reviewEmployee.name}
              </p>
              <p>
                <span className="font-medium">Age:</span> {reviewEmployee.age}
              </p>
              <p>
                <span className="font-medium">Annual Gross:</span>{" "}
                {eur(reviewEmployee.annual_gross)}
              </p>
              <p>
                <span className="font-medium">Status:</span>{" "}
                {STATUS_CONFIG[reviewEmployee.status].label}
              </p>
              <p className="text-xs text-muted-foreground">
                Review the employee's eligibility criteria. Employees under 23
                or over 66, or earning below the threshold, may be exempt from
                auto-enrolment.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -- Sub-components --

function EmployeeActions({
  employee,
  pastReEnrolDate,
  onEnrol,
  onSuspend,
  onReEnrol,
  onReview,
  enrolLoading,
  suspendLoading,
  reEnrolLoading,
}: {
  employee: AutoEnrolmentEmployee;
  pastReEnrolDate: boolean;
  onEnrol: (id: string) => void;
  onSuspend: (id: string) => void;
  onReEnrol: (id: string) => void;
  onReview: (emp: AutoEnrolmentEmployee) => void;
  enrolLoading: boolean;
  suspendLoading: boolean;
  reEnrolLoading: boolean;
}) {
  switch (employee.status) {
    case "pending":
      return (
        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs gap-1"
          onClick={() => onEnrol(employee.id)}
          disabled={enrolLoading}
        >
          {enrolLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Enrol
        </Button>
      );
    case "enrolled":
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => onSuspend(employee.id)}
          disabled={suspendLoading}
        >
          {suspendLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Shield className="h-3 w-3" />
          )}
          Suspend
        </Button>
      );
    case "opted_out":
      if (pastReEnrolDate) {
        return (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => onReEnrol(employee.id)}
            disabled={reEnrolLoading}
          >
            {reEnrolLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Re-enrol
          </Button>
        );
      }
      return (
        <span className="text-xs text-muted-foreground">
          Re-enrol after {formatDate(employee.re_enrolment_date)}
        </span>
      );
    case "exempt":
      return (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => onReview(employee)}
        >
          Review
        </Button>
      );
    default:
      return <span className="text-xs text-muted-foreground">\u2014</span>;
  }
}

function ContributionStatusBadge({
  status,
}: {
  status: string;
}) {
  switch (status) {
    case "accepted":
      return (
        <Badge className="bg-green-600 hover:bg-green-700 text-[10px]">Accepted</Badge>
      );
    case "submitted":
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-[10px]">Submitted</Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="text-[10px]">Rejected</Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
      );
  }
}
