import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Users,
  Shield,
  Building2,
  TrendingUp,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  ClipboardList,
  ScrollText,
  BookOpen,
} from "lucide-react";
import { useCROAnnualAccounts, useCROCompany } from "@/hooks/accountant/useCRO";
import { useAssembleAuditSnapshot } from "@/hooks/accountant/useAssembleAuditSnapshot";
import { toast } from "sonner";
import type { CROAnnualAccounts } from "@/types/cro";
import type { AuditSnapshot } from "@/lib/cro/assembleAuditSnapshot";
import { classifyCompanySize, COMPANY_SIZE_THRESHOLDS, type CompanySizeResult } from "@/lib/cro/companySize";
import { assembleAbridgedAccountsData, type AbridgedAccountsInput } from "@/lib/reports/abridgedAccountsData";
import { generateAbridgedAccountsPdf } from "@/lib/reports/pdf/abridgedAccountsPdf";
import { generateAbridgedAccountsExcel } from "@/lib/reports/excel/abridgedAccountsExcel";
import type { ReportMeta } from "@/lib/reports/types";
import { Download } from "lucide-react";

interface CROAnnualAccountsViewProps {
  croCompanyId: string;
  clientUserId?: string;
}

const eur = (n: number | null) =>
  n == null
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
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

function getYearLabel(dateStr: string): string {
  return new Date(dateStr).getFullYear().toString();
}

function dataSourceBadge(source: CROAnnualAccounts["data_source"], confidence?: number | null) {
  const config: Record<string, { label: string; className: string }> = {
    balnce_auto: { label: "Balnce Auto", className: "bg-green-100 text-green-700 border-green-200" },
    pdf_extraction: {
      label: `PDF Extraction${confidence != null ? ` (${Math.round(confidence * 100)}%)` : ""}`,
      className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    manual: { label: "Manual", className: "bg-blue-100 text-blue-700 border-blue-200" },
    accountant_import: {
      label: "Accountant Import",
      className: "bg-purple-100 text-purple-700 border-purple-200",
    },
  };
  const c = config[source] ?? { label: source, className: "" };
  return <Badge className={c.className}>{c.label}</Badge>;
}

function auditOpinionBadge(opinion: string | undefined) {
  if (!opinion) return null;
  const config: Record<string, string> = {
    unqualified: "bg-green-100 text-green-700 border-green-200",
    qualified: "bg-amber-100 text-amber-700 border-amber-200",
    adverse: "bg-red-100 text-red-700 border-red-200",
    disclaimer: "bg-red-100 text-red-700 border-red-200",
    exempt: "bg-gray-100 text-gray-700 border-gray-200",
  };
  return (
    <Badge className={config[opinion] ?? ""}>
      {opinion.charAt(0).toUpperCase() + opinion.slice(1)}
    </Badge>
  );
}

// Accordion section component
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <div className="px-4 pb-4 text-sm space-y-2">{children}</div>}
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function BalanceSheet({ accounts }: { accounts: CROAnnualAccounts }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: Assets */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Fixed Assets</h4>
        <LineItem label="Tangible Assets" value={eur(accounts.fixed_assets_tangible)} />
        <LineItem label="Intangible Assets" value={eur(accounts.fixed_assets_intangible)} />
        <LineItem label="Investments" value={eur(accounts.fixed_assets_investments)} />
        <Separator />
        <h4 className="text-sm font-semibold">Current Assets</h4>
        <LineItem label="Stock" value={eur(accounts.current_assets_stock)} />
        <LineItem label="Debtors" value={eur(accounts.current_assets_debtors)} />
        <LineItem label="Cash at Bank" value={eur(accounts.current_assets_cash)} />
        {accounts.current_assets_other != null && (
          <LineItem label="Other" value={eur(accounts.current_assets_other)} />
        )}
      </div>

      {/* Right: Liabilities & Equity */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Creditors: amounts falling due within one year</h4>
        <LineItem label="Creditors < 1yr" value={eur(accounts.creditors_within_one_year)} />
        <Separator />
        <LineItem label="Net Current Assets" value={eur(accounts.net_current_assets)} />
        <Separator />
        <h4 className="text-sm font-semibold">Creditors: amounts falling due after one year</h4>
        <LineItem label="Creditors > 1yr" value={eur(accounts.creditors_after_one_year)} />
        {accounts.provisions_for_liabilities != null && (
          <LineItem label="Provisions" value={eur(accounts.provisions_for_liabilities)} />
        )}
        <Separator />
        <LineItem label="Net Assets" value={eur(accounts.net_assets)} />
        <Separator />
        <h4 className="text-sm font-semibold">Capital & Reserves</h4>
        <LineItem label="Share Capital" value={eur(accounts.share_capital)} />
        {accounts.share_premium != null && (
          <LineItem label="Share Premium" value={eur(accounts.share_premium)} />
        )}
        <LineItem label="Retained Profits" value={eur(accounts.retained_profits)} />
        {accounts.other_reserves != null && (
          <LineItem label="Other Reserves" value={eur(accounts.other_reserves)} />
        )}
        <Separator />
        <LineItem label="Shareholders' Funds" value={eur(accounts.shareholders_funds)} />
      </div>
    </div>
  );
}

function ProfitAndLoss({ accounts }: { accounts: CROAnnualAccounts }) {
  return (
    <div className="max-w-md space-y-1">
      <LineItem label="Turnover" value={eur(accounts.turnover)} />
      <LineItem label="Cost of Sales" value={eur(accounts.cost_of_sales)} />
      <Separator />
      <LineItem label="Gross Profit" value={eur(accounts.gross_profit)} />
      <LineItem label="Operating Expenses" value={eur(accounts.operating_expenses)} />
      <Separator />
      <LineItem label="Operating Profit" value={eur(accounts.operating_profit)} />
      {accounts.interest_payable != null && (
        <LineItem label="Interest Payable" value={eur(accounts.interest_payable)} />
      )}
      {accounts.profit_before_tax != null && (
        <LineItem label="Profit Before Tax" value={eur(accounts.profit_before_tax)} />
      )}
      <LineItem label="Taxation" value={eur(accounts.taxation)} />
      <Separator />
      <LineItem label="Profit After Tax" value={eur(accounts.profit_after_tax)} />
      <LineItem label="Dividends Paid" value={eur(accounts.dividends_paid)} />
      <Separator />
      <LineItem label="Retained Profit for Year" value={eur(accounts.retained_profit_for_year)} />
    </div>
  );
}

function NotesToAccounts({ accounts }: { accounts: CROAnnualAccounts }) {
  const notes = accounts.notes;
  if (!notes) return null;

  return (
    <div className="space-y-2">
      {notes.accounting_policies && (
        <Section title="Accounting Policies" icon={<FileSpreadsheet className="h-4 w-4" />}>
          {notes.accounting_policies.basis_of_preparation && (
            <div>
              <span className="font-medium">Basis of Preparation:</span>{" "}
              {notes.accounting_policies.basis_of_preparation}
            </div>
          )}
          {notes.accounting_policies.revenue_recognition && (
            <div>
              <span className="font-medium">Revenue Recognition:</span>{" "}
              {notes.accounting_policies.revenue_recognition}
            </div>
          )}
          {notes.accounting_policies.depreciation && (
            <div>
              <span className="font-medium">Depreciation:</span>{" "}
              {notes.accounting_policies.depreciation}
            </div>
          )}
          {notes.accounting_policies.going_concern && (
            <div>
              <span className="font-medium">Going Concern:</span>{" "}
              {notes.accounting_policies.going_concern}
            </div>
          )}
        </Section>
      )}

      {notes.directors_report && (
        <Section title="Directors' Report" icon={<Users className="h-4 w-4" />}>
          {notes.directors_report.principal_activities && (
            <div>
              <span className="font-medium">Principal Activities:</span>{" "}
              {notes.directors_report.principal_activities}
            </div>
          )}
          {notes.directors_report.review_of_business && (
            <div>
              <span className="font-medium">Review of Business:</span>{" "}
              {notes.directors_report.review_of_business}
            </div>
          )}
          {notes.directors_report.future_developments && (
            <div>
              <span className="font-medium">Future Developments:</span>{" "}
              {notes.directors_report.future_developments}
            </div>
          )}
          {notes.directors_report.dividends && (
            <div>
              <span className="font-medium">Dividends:</span> {notes.directors_report.dividends}
            </div>
          )}
          {notes.directors_report.post_balance_sheet_events && (
            <div>
              <span className="font-medium">Post Balance Sheet Events:</span>{" "}
              {notes.directors_report.post_balance_sheet_events}
            </div>
          )}
        </Section>
      )}

      {(notes.directors || notes.secretary) && (
        <Section title="Directors & Secretary" icon={<Users className="h-4 w-4" />}>
          {notes.directors && notes.directors.length > 0 && (
            <div>
              <span className="font-medium">Directors:</span>
              <ul className="list-disc list-inside mt-1">
                {notes.directors.map((d, i) => (
                  <li key={i}>
                    {d.name}
                    {d.appointed_date && ` (appointed ${formatDate(d.appointed_date)})`}
                    {d.resigned_date && ` (resigned ${formatDate(d.resigned_date)})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {notes.secretary && (
            <div>
              <span className="font-medium">Secretary:</span> {notes.secretary.name}
            </div>
          )}
        </Section>
      )}

      {(notes.auditor_name || notes.audit_opinion) && (
        <Section title="Audit" icon={<Shield className="h-4 w-4" />}>
          {notes.auditor_name && (
            <div>
              <span className="font-medium">Auditor:</span> {notes.auditor_name}
            </div>
          )}
          {notes.audit_opinion && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Opinion:</span> {auditOpinionBadge(notes.audit_opinion)}
            </div>
          )}
        </Section>
      )}

      {(notes.employees || notes.director_remuneration != null) && (
        <Section title="Employees" icon={<Users className="h-4 w-4" />}>
          {notes.employees?.avg_number != null && (
            <div>
              <span className="font-medium">Average Number of Employees:</span>{" "}
              {notes.employees.avg_number}
            </div>
          )}
          {notes.employees?.staff_costs != null && (
            <div>
              <span className="font-medium">Staff Costs:</span> {eur(notes.employees.staff_costs)}
            </div>
          )}
          {notes.director_remuneration != null && (
            <div>
              <span className="font-medium">Director Remuneration:</span>{" "}
              {eur(notes.director_remuneration)}
            </div>
          )}
        </Section>
      )}

      {notes.related_party_transactions && (
        <Section title="Related Party Transactions" icon={<Building2 className="h-4 w-4" />}>
          <p>{notes.related_party_transactions}</p>
        </Section>
      )}

      {(notes.contingent_liabilities || notes.capital_commitments) && (
        <Section title="Contingent Liabilities & Commitments" icon={<Shield className="h-4 w-4" />}>
          {notes.contingent_liabilities && (
            <div>
              <span className="font-medium">Contingent Liabilities:</span>{" "}
              {notes.contingent_liabilities}
            </div>
          )}
          {notes.capital_commitments && (
            <div>
              <span className="font-medium">Capital Commitments:</span>{" "}
              {notes.capital_commitments}
            </div>
          )}
        </Section>
      )}

      {notes.going_concern && (
        <Section title="Going Concern" icon={<TrendingUp className="h-4 w-4" />}>
          <p>{notes.going_concern}</p>
        </Section>
      )}
    </div>
  );
}

export function CROAnnualAccountsView({ croCompanyId, clientUserId }: CROAnnualAccountsViewProps) {
  const { data: allAccounts, isLoading } = useCROAnnualAccounts(croCompanyId);
  const { data: croCompany } = useCROCompany(clientUserId);
  const assembleMutation = useAssembleAuditSnapshot();
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const years = (allAccounts ?? []).map((a) => a.financial_year_end);
  const activeYear = selectedYear ?? years[0] ?? null;
  const accounts = (allAccounts ?? []).find((a) => a.financial_year_end === activeYear) ?? null;

  // Derive the tax year from the active financial_year_end (e.g. "2025-12-31" → "2025")
  const activeTaxYear = activeYear ? new Date(activeYear).getFullYear().toString() : new Date().getFullYear().toString();

  const handleGenerate = () => {
    if (!clientUserId) {
      toast.error("Client user ID is required to generate accounts");
      return;
    }
    assembleMutation.mutate(
      { clientUserId, taxYear: activeTaxYear, croCompanyId },
      {
        onSuccess: () => toast.success("Accounts generated from Balnce data"),
        onError: (err) => toast.error(`Failed to generate accounts: ${err.message}`),
      },
    );
  };

  const handleAbridgedExport = (exportType: "pdf" | "excel") => {
    if (!accounts) return;

    const snapshot = accounts.notes as unknown as AuditSnapshot | null;
    const directorNames: string[] = snapshot?.directors_report?.directors ?? [];
    if (directorNames.length === 0) {
      // Fallback to notes directors list
      const noteDirectors = (accounts.notes as Record<string, unknown>)?.directors;
      if (Array.isArray(noteDirectors)) {
        for (const d of noteDirectors) {
          if (typeof d === "object" && d && "name" in d) directorNames.push((d as { name: string }).name);
        }
      }
      if (directorNames.length === 0) directorNames.push("Director");
    }

    const companyName = croCompany?.company_name ?? "Company";
    const croNumber = croCompany?.company_number ?? "";
    const address = croCompany?.address ?? "";

    const yearEnd = activeYear
      ? new Date(activeYear).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })
      : `31 December ${activeTaxYear}`;

    const abInput: AbridgedAccountsInput = {
      companyName,
      croNumber,
      registeredAddress: address,
      accountingYearEnd: yearEnd,
      directorNames,
      companySecretaryName: snapshot?.directors_report?.secretary,
      fixedAssetsTangible: accounts.fixed_assets_tangible ?? 0,
      stock: accounts.current_assets_stock ?? 0,
      wip: 0,
      debtors: accounts.current_assets_debtors ?? 0,
      prepayments: 0,
      accruedIncome: 0,
      cashAtBank: accounts.current_assets_cash ?? 0,
      creditors: accounts.creditors_within_one_year ?? 0,
      accruals: 0,
      deferredIncome: 0,
      taxation: accounts.taxation ?? 0,
      bankLoans: accounts.creditors_after_one_year ?? 0,
      directorsLoans: 0,
      shareCapital: accounts.share_capital ?? 100,
      retainedProfits: accounts.retained_profits ?? 0,
    };

    const meta: ReportMeta = {
      companyName,
      taxYear: activeTaxYear,
      generatedDate: new Date().toISOString(),
      preparedBy: "Balnce",
    };

    const reportData = assembleAbridgedAccountsData(abInput, meta);

    if (exportType === "pdf") {
      generateAbridgedAccountsPdf(reportData);
    } else {
      generateAbridgedAccountsExcel(reportData);
    }
    toast.success(`Abridged accounts exported as ${exportType.toUpperCase()}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Annual Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading accounts...</div>
        </CardContent>
      </Card>
    );
  }

  if (!allAccounts || allAccounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Annual Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <FileSpreadsheet className="h-10 w-10 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">No annual accounts on file</p>
            <p className="text-xs mt-1 mb-4">Accounts will appear here once synced or imported</p>
            {clientUserId && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                disabled={assembleMutation.isPending}
              >
                {assembleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Generate from Balnce
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Annual Accounts
        </CardTitle>
        <div className="flex items-center gap-2">
          {accounts && (
            <Button size="sm" variant="outline" onClick={() => handleAbridgedExport("pdf")}>
              <Download className="h-4 w-4 mr-1" />
              Download PDF
            </Button>
          )}
          {clientUserId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={assembleMutation.isPending}
            >
              {assembleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  Generate from Balnce
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Year Selector Tabs */}
        <div className="flex gap-1 border-b">
          {years.map((year) => (
            <Button
              key={year}
              variant="ghost"
              size="sm"
              className={`rounded-none border-b-2 ${
                year === activeYear
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSelectedYear(year)}
            >
              {getYearLabel(year)}
            </Button>
          ))}
        </div>

        {accounts && (
          <>
            {/* Balance Sheet */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Balance Sheet</h3>
              <BalanceSheet accounts={accounts} />
            </div>

            <Separator />

            {/* Profit & Loss */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Profit & Loss</h3>
              <ProfitAndLoss accounts={accounts} />
            </div>

            <Separator />

            {/* Notes to Accounts */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Notes to Accounts</h3>
              <NotesToAccounts accounts={accounts} />
            </div>

            <Separator />

            {/* Data Quality */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">Data Source:</span>
              {dataSourceBadge(accounts.data_source, accounts.extraction_confidence)}
              {accounts.reviewed_by && (
                <span className="text-muted-foreground">
                  Reviewed by {accounts.reviewed_by} on {formatDate(accounts.reviewed_at)}
                </span>
              )}
            </div>
            {accounts.review_notes && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                {accounts.review_notes}
              </p>
            )}

            {/* Company Size & Filing Requirements */}
            <Separator />
            <CompanySizeSection accounts={accounts} />

            {/* Abridged Accounts (from audit snapshot) */}
            {accounts.notes && (accounts.notes as unknown as AuditSnapshot).snapshot_version && (
              <>
                <Separator />
                <AbridgedAccountsSection snapshot={accounts.notes as unknown as AuditSnapshot} />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Company Size & CRO Filing Requirements
// ---------------------------------------------------------------------------

function CompanySizeSection({ accounts }: { accounts: CROAnnualAccounts }) {
  const balanceSheetTotal =
    (accounts.fixed_assets_tangible ?? 0) +
    (accounts.fixed_assets_intangible ?? 0) +
    (accounts.fixed_assets_investments ?? 0) +
    (accounts.current_assets_stock ?? 0) +
    (accounts.current_assets_debtors ?? 0) +
    (accounts.current_assets_cash ?? 0) +
    (accounts.current_assets_other ?? 0);

  // Try to get employee count from audit snapshot notes, fallback to 1
  const snapshot = accounts.notes as unknown as AuditSnapshot | null;
  const avgEmployees = snapshot?.onboarding?.employee_count ?? 1;

  const result = classifyCompanySize({
    balanceSheetTotal,
    netTurnover: accounts.turnover ?? 0,
    averageEmployees: avgEmployees,
  });

  const sizeBadgeColor: Record<string, string> = {
    micro: "bg-blue-100 text-blue-700 border-blue-200",
    small: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    large: "bg-red-100 text-red-700 border-red-200",
  };

  const reqIcon = (status: string) => {
    if (status === "exempt") return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (status === "abridged") return <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600" />;
    return <ClipboardList className="h-3.5 w-3.5 text-red-600" />;
  };

  const reqLabel = (status: string) => {
    if (status === "exempt") return "Exempt";
    if (status === "abridged") return "Abridged";
    if (status === "minimal") return "Minimal";
    if (status === "selected") return "Selected";
    return "Full / Required";
  };

  const fr = result.filingRequirements;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Company Classification</h3>
        <Badge className={sizeBadgeColor[result.size]}>{result.label}</Badge>
        {result.auditExempt && (
          <Badge className="bg-green-100 text-green-700 border-green-200">Audit Exempt</Badge>
        )}
      </div>

      {/* Thresholds check */}
      <div className="text-xs text-muted-foreground">
        <p>
          Balance sheet: {eur(balanceSheetTotal)} | Turnover: {eur(accounts.turnover)} | Employees: {avgEmployees}
        </p>
        <p className="mt-0.5">
          Thresholds met — Micro: {result.thresholdsMet.micro}/3, Small: {result.thresholdsMet.small}/3, Medium: {result.thresholdsMet.medium}/3
          {" "}(need 2 of 3 to qualify)
        </p>
      </div>

      {/* Filing requirements table */}
      <div className="border rounded-md">
        <div className="grid grid-cols-2 gap-0 text-xs">
          {[
            { label: "Balance Sheet", value: fr.balanceSheet },
            { label: "Profit & Loss", value: fr.profitAndLoss },
            { label: "Directors' Report", value: fr.directorsReport },
            { label: "Notes to Accounts", value: fr.notesToAccounts },
            { label: "Auditor's Report", value: fr.auditorReport },
            { label: "Cash Flow Statement", value: fr.cashFlowStatement },
          ].map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center gap-2 px-3 py-2 ${i < 4 ? "border-b" : ""} ${i % 2 === 0 ? "border-r" : ""}`}
            >
              {reqIcon(item.value)}
              <span className="text-muted-foreground">{item.label}:</span>
              <span className="font-medium">{reqLabel(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{fr.description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Abridged Accounts Section (shown when notes contain a full audit snapshot)
// ---------------------------------------------------------------------------

function AbridgedAccountsSection({ snapshot }: { snapshot: AuditSnapshot }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Abridged Accounts (Auto-generated)</h3>
      <p className="text-xs text-muted-foreground">
        Generated {new Date(snapshot.snapshot_at).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" })}
        {" "}at {new Date(snapshot.snapshot_at).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}
        {" | "}Version {snapshot.snapshot_version}
      </p>

      {/* Directors' Report */}
      <Section title="Directors' Report" icon={<ScrollText className="h-4 w-4" />}>
        <div className="space-y-3">
          <div>
            <span className="font-medium">Principal Activities:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.principal_activities}</span>
          </div>
          <div>
            <span className="font-medium">Review of Business:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.review_of_business}</span>
          </div>
          <div>
            <span className="font-medium">Future Developments:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.future_developments}</span>
          </div>
          <div>
            <span className="font-medium">Dividends:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.dividends}</span>
          </div>
          <div>
            <span className="font-medium">Post Balance Sheet Events:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.post_balance_sheet_events}</span>
          </div>
          <Separator />
          <div>
            <span className="font-medium">Directors:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.directors.join(", ")}</span>
          </div>
          <div>
            <span className="font-medium">Secretary:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.secretary}</span>
          </div>
          <div>
            <span className="font-medium">Accounting Standards:</span>{" "}
            <span className="text-muted-foreground">{snapshot.directors_report.accounting_standards}</span>
          </div>
        </div>
      </Section>

      {/* Notes to the Accounts */}
      <Section title="Notes to the Accounts" icon={<BookOpen className="h-4 w-4" />}>
        <div className="space-y-3">
          <div>
            <span className="font-medium">Basis of Preparation:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.basis_of_preparation}</span>
          </div>
          <div>
            <span className="font-medium">Revenue Recognition:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.revenue_recognition}</span>
          </div>
          <div>
            <span className="font-medium">Depreciation Policy:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.depreciation_policy}</span>
          </div>
          <div>
            <span className="font-medium">Going Concern:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.going_concern}</span>
          </div>
          <Separator />
          <div>
            <span className="font-medium">Employees:</span>{" "}
            <span className="text-muted-foreground">
              Average {snapshot.notes_to_accounts.employees.avg_number} employees, staff costs{" "}
              {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(snapshot.notes_to_accounts.employees.staff_costs)}
            </span>
          </div>
          <div>
            <span className="font-medium">Director Remuneration:</span>{" "}
            <span className="text-muted-foreground">
              {new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(snapshot.notes_to_accounts.director_remuneration)}
            </span>
          </div>
          <Separator />
          <div>
            <span className="font-medium">Related Party Transactions:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.related_party_transactions}</span>
          </div>
          <div>
            <span className="font-medium">Contingent Liabilities:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.contingent_liabilities}</span>
          </div>
          <div>
            <span className="font-medium">Capital Commitments:</span>{" "}
            <span className="text-muted-foreground">{snapshot.notes_to_accounts.capital_commitments}</span>
          </div>
        </div>
      </Section>

      {/* Completeness Checklist */}
      <Section title="Completeness Checklist" icon={<ClipboardList className="h-4 w-4" />}>
        <div className="space-y-2">
          {snapshot.completeness_checklist.map((item) => (
            <div key={item.key} className="flex items-start gap-2">
              {item.passed ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              )}
              <div>
                <span className={item.passed ? "text-foreground" : "text-red-600 font-medium"}>
                  {item.label}
                </span>
                {item.detail && (
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
