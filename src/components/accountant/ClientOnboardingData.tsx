/**
 * Read-only display of a client's onboarding answers for the accountant portal.
 * Shows business onboarding (onboarding_settings) and director onboarding data.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Receipt,
  Users,
  Truck,
  Globe,
  User,
  Briefcase,
  Car,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { useClientOnboardingSettings, useClientDirectorOnboarding } from "@/hooks/accountant/useClientData";

interface ClientOnboardingDataProps {
  clientUserId: string | null | undefined;
}

function BoolBadge({ value, label }: { value: boolean | null; label?: string }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  return value ? (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
      <CheckCircle2 className="w-3 h-3" /> {label ?? "Yes"}
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="w-3 h-3" /> {label ?? "No"}
    </Badge>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-sm">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
      <Icon className="w-4 h-4 text-primary" />
      <h4 className="text-sm font-semibold">{title}</h4>
    </div>
  );
}

function formatBusinessType(bt: string | null): string {
  if (!bt) return "—";
  return bt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function formatCurrency(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `€${v.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ArrayField({ label, items }: { label: string; items: string[] | null }) {
  if (!items?.length) return <Field label={label} value="—" />;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <Badge key={item} variant="outline" className="text-xs">
            {item.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function ClientOnboardingData({ clientUserId }: ClientOnboardingDataProps) {
  const { data: onboarding, isLoading: obLoading } = useClientOnboardingSettings(clientUserId);
  const { data: directors, isLoading: dirLoading } = useClientDirectorOnboarding(clientUserId);

  const isLoading = obLoading || dirLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading client onboarding data...</span>
      </div>
    );
  }

  if (!onboarding && (!directors || directors.length === 0)) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">No onboarding data found</p>
          <p className="text-xs mt-1">This client hasn't completed their onboarding questionnaire yet.</p>
        </CardContent>
      </Card>
    );
  }

  const ob = onboarding;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Client Onboarding Answers
          </h4>
          {ob?.onboarding_completed ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
              <CheckCircle2 className="w-3 h-3" /> Completed {formatDate(ob.completed_at)}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">In Progress</Badge>
          )}
        </div>
      </Card>

      {/* Business Details */}
      {ob && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="pt-5 space-y-6">
            {/* Company Info */}
            <div>
              <SectionHeader icon={Building2} title="Business Details" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Business Name" value={ob.business_name} />
                <Field label="Business Type" value={formatBusinessType(ob.business_type)} />
                <Field label="Industry" value={ob.industry} />
                <Field label="Year End" value={formatDate(ob.year_end)} />
                <Field label="Sells" value={formatBusinessType(ob.sells)} />
                <Field label="Payment Terms" value={ob.payment_terms} />
              </div>
              {ob.business_description && (
                <div className="mt-3">
                  <Field label="Business Description" value={ob.business_description} />
                </div>
              )}
            </div>

            {/* VAT */}
            <div>
              <SectionHeader icon={Receipt} title="VAT Registration" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium">VAT Registered</span>
                  <BoolBadge value={ob.vat_registered} />
                </div>
                {ob.vat_registered && (
                  <>
                    <Field label="VAT Number" value={ob.vat_number} />
                    <Field label="VAT Basis" value={formatBusinessType(ob.vat_basis)} />
                    <Field label="VAT Frequency" value={formatBusinessType(ob.vat_frequency)} />
                    <ArrayField label="VAT Rates Used" items={ob.vat_rates_used} />
                  </>
                )}
              </div>
            </div>

            {/* Employees & Subcontractors */}
            <div>
              <SectionHeader icon={Users} title="Employees & Subcontractors" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium">Has Employees</span>
                  <BoolBadge value={ob.has_employees} />
                </div>
                {ob.has_employees && (
                  <>
                    <Field label="Employee Count" value={ob.employee_count?.toString()} />
                    <Field label="Payroll Frequency" value={formatBusinessType(ob.payroll_frequency)} />
                  </>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium">Uses Subcontractors</span>
                  <BoolBadge value={ob.uses_subcontractors} />
                </div>
              </div>
            </div>

            {/* Income & Expenses */}
            <div>
              <SectionHeader icon={Briefcase} title="Income & Expenses" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ArrayField label="Income Streams" items={ob.income_streams} />
                <ArrayField label="Expense Types" items={ob.expense_types} />
                <ArrayField label="Transaction Sources" items={ob.transaction_sources} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium">Invoicing</span>
                  <BoolBadge value={ob.invoicing} />
                </div>
              </div>
            </div>

            {/* EU Trade */}
            {ob.eu_trade_enabled && (
              <div>
                <SectionHeader icon={Globe} title="EU & International Trade" />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Sells Goods to EU</span>
                    <BoolBadge value={ob.sells_goods_to_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Buys Goods from EU</span>
                    <BoolBadge value={ob.buys_goods_from_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Sells Services to EU</span>
                    <BoolBadge value={ob.sells_services_to_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Buys Services from EU</span>
                    <BoolBadge value={ob.buys_services_from_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Sells to Non-EU</span>
                    <BoolBadge value={ob.sells_to_non_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Buys from Non-EU</span>
                    <BoolBadge value={ob.buys_from_non_eu} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Digital Services B2C</span>
                    <BoolBadge value={ob.sells_digital_services_b2c} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Section 56 Authorisation</span>
                    <BoolBadge value={ob.has_section_56_authorisation} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground font-medium">Postponed Accounting</span>
                    <BoolBadge value={ob.uses_postponed_accounting} />
                  </div>
                </div>
              </div>
            )}

            {/* Preferences */}
            <div>
              <SectionHeader icon={Truck} title="Preferences" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Receipt Upload Method" value={formatBusinessType(ob.receipt_upload_method)} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground font-medium">OCR Required</span>
                  <BoolBadge value={ob.ocr_required} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Director Onboarding */}
      {directors && directors.length > 0 && (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="pt-5 space-y-6">
            {directors.map((dir) => {
              const d = dir as Record<string, unknown>;
              const obData = (d.onboarding_data ?? {}) as Record<string, unknown>;

              return (
                <div key={d.id as string}>
                  <SectionHeader
                    icon={User}
                    title={`Director ${d.director_number}: ${(d.director_name as string) || "Unnamed"}`}
                  />
                  <div className="space-y-4">
                    {/* Personal Details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Field label="Name" value={d.director_name as string} />
                      <Field label="PPS Number" value={d.pps_number as string} />
                      <Field label="Date of Birth" value={formatDate(d.date_of_birth as string)} />
                      <Field label="Marital Status" value={formatBusinessType(d.marital_status as string)} />
                      <Field label="Assessment Basis" value={formatBusinessType(d.assessment_basis as string)} />
                      <Field label="Annual Salary" value={formatCurrency(d.annual_salary as number)} />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">Receives Dividends</span>
                        <BoolBadge value={d.receives_dividends as boolean} />
                      </div>
                      {d.receives_dividends && (
                        <Field label="Estimated Dividends" value={formatCurrency(d.estimated_dividends as number)} />
                      )}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">Onboarding Completed</span>
                        <BoolBadge value={d.onboarding_completed as boolean} />
                      </div>
                    </div>

                    {/* Vehicle Info (from onboarding_data JSONB) */}
                    {obData.vehicle_owned_by_director && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Car className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Vehicle
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <Field label="Description" value={obData.vehicle_description as string} />
                          <Field label="Registration" value={obData.vehicle_reg as string} />
                          <Field label="Purchase Cost" value={formatCurrency(obData.vehicle_purchase_cost as number)} />
                          <Field label="Date Acquired" value={formatDate(obData.vehicle_date_acquired as string)} />
                          <Field
                            label="Business Use %"
                            value={obData.vehicle_business_use_pct ? `${obData.vehicle_business_use_pct}%` : null}
                          />
                        </div>
                      </div>
                    )}

                    {/* Additional onboarding_data fields */}
                    {Object.keys(obData).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Additional Details
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {obData.has_rental_income != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Rental Income</span>
                              <BoolBadge value={!!obData.has_rental_income} />
                            </div>
                          )}
                          {(obData.rental_income as number) > 0 && (
                            <Field label="Rental Income Amount" value={formatCurrency(obData.rental_income as number)} />
                          )}
                          {obData.has_foreign_income != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Foreign Income</span>
                              <BoolBadge value={!!obData.has_foreign_income} />
                            </div>
                          )}
                          {obData.has_capital_gains != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Capital Gains</span>
                              <BoolBadge value={!!obData.has_capital_gains} />
                            </div>
                          )}
                          {obData.has_other_employment != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Other Employment</span>
                              <BoolBadge value={!!obData.has_other_employment} />
                            </div>
                          )}
                          {(obData.other_employment_income as number) > 0 && (
                            <Field label="Other Employment Income" value={formatCurrency(obData.other_employment_income as number)} />
                          )}
                          {obData.preliminary_tax_paid != null && (Number(obData.preliminary_tax_paid) > 0) && (
                            <Field label="Preliminary Tax Paid" value={formatCurrency(obData.preliminary_tax_paid as number)} />
                          )}
                          {obData.home_office != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Home Office</span>
                              <BoolBadge value={!!obData.home_office} />
                            </div>
                          )}
                          {(obData.home_office_days_per_week as number) > 0 && (
                            <Field label="WFH Days/Week" value={`${obData.home_office_days_per_week}`} />
                          )}
                          {obData.medical_insurance != null && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground font-medium">Medical Insurance</span>
                              <BoolBadge value={!!obData.medical_insurance} />
                            </div>
                          )}
                          {(obData.medical_insurance_cost as number) > 0 && (
                            <Field label="Medical Insurance Cost" value={formatCurrency(obData.medical_insurance_cost as number)} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
