import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FilingType } from "@/types/accountant";

interface FilingReviewPanelProps {
  filingType: FilingType;
  snapshot: Record<string, unknown> | null;
  taxPeriodStart: string;
  taxPeriodEnd: string;
}

/**
 * Read-only display of the questionnaire snapshot captured at filing creation.
 * Shows the data the accountant is reviewing before approval.
 */
export function FilingReviewPanel({
  filingType,
  snapshot,
  taxPeriodStart,
  taxPeriodEnd,
}: FilingReviewPanelProps) {
  if (!snapshot) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No questionnaire data captured for this filing.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filing Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Period Start</p>
              <p className="font-medium">{taxPeriodStart}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Period End</p>
              <p className="font-medium">{taxPeriodEnd}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {filingType === "ct1" && <CT1SnapshotView snapshot={snapshot} />}
      {filingType === "form11" && <Form11SnapshotView snapshot={snapshot} />}
      {filingType === "vat3" && <VAT3SnapshotView snapshot={snapshot} />}
      {!["ct1", "form11", "vat3"].includes(filingType) && (
        <GenericSnapshotView snapshot={snapshot} />
      )}
    </div>
  );
}

function CT1SnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const sections = [
    {
      title: "Income",
      rows: [
        { label: "Gross Income", key: "totalIncome" },
        { label: "Allowable Expenses", key: "allowableExpenses" },
        { label: "Disallowed Expenses", key: "disallowedExpenses" },
        { label: "Trading Profit", key: "tradingProfit" },
      ],
    },
    {
      title: "Balance Sheet",
      rows: [
        { label: "Fixed Assets", key: "fixedAssetsTotal" },
        { label: "Current Assets", key: "currentAssetsTotal" },
        { label: "Liabilities", key: "liabilitiesTotal" },
        { label: "Directors Loan", key: "directorsLoanBalance" },
      ],
    },
    {
      title: "Tax",
      rows: [
        { label: "CT Liability", key: "ctLiability" },
        { label: "Close Company Surcharge", key: "closeCompanySurcharge" },
        { label: "RCT Credit", key: "rctCredit" },
        { label: "Preliminary CT Paid", key: "preliminaryCTPaid" },
      ],
    },
  ];

  return <SectionedView sections={sections} snapshot={snapshot} />;
}

function Form11SnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const sections = [
    {
      title: "Personal Details",
      rows: [
        { label: "Director Name", key: "directorName" },
        { label: "PPS Number", key: "ppsNumber" },
        { label: "Marital Status", key: "maritalStatus" },
        { label: "Assessment Basis", key: "assessmentBasis" },
      ],
    },
    {
      title: "Income",
      rows: [
        { label: "Salary", key: "salary" },
        { label: "Dividends", key: "dividends" },
        { label: "BIK", key: "bik" },
        { label: "Business Income", key: "businessIncome" },
        { label: "Business Expenses", key: "businessExpenses" },
        { label: "Rental Income", key: "rentalIncome" },
      ],
    },
    {
      title: "Reliefs & Credits",
      rows: [
        { label: "Pension Contributions", key: "pensionContributions" },
        { label: "Medical Expenses", key: "medicalExpenses" },
        { label: "Rent Paid", key: "rentPaid" },
        { label: "Charitable Donations", key: "charitableDonations" },
        { label: "Home Carer Credit", key: "claimHomeCarer" },
      ],
    },
    {
      title: "Tax Calculation",
      rows: [
        { label: "Total Gross Income", key: "totalGrossIncome" },
        { label: "Total Tax Credits", key: "totalCredits" },
        { label: "Total Liability", key: "totalLiability" },
        { label: "Preliminary Tax Paid", key: "preliminaryTaxPaid" },
        { label: "Balance Due", key: "balanceDue" },
      ],
    },
  ];

  return <SectionedView sections={sections} snapshot={snapshot} />;
}

function VAT3SnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const sections = [
    {
      title: "VAT Return",
      rows: [
        { label: "T1 — Sales", key: "t1Sales" },
        { label: "T2 — VAT on Sales", key: "t2Vat" },
        { label: "T3 — Purchases", key: "t3Purchases" },
        { label: "T4 — VAT on Purchases", key: "t4InputVat" },
        { label: "Net VAT", key: "netVat" },
        { label: "VAT Number", key: "vatNumber" },
      ],
    },
  ];

  return <SectionedView sections={sections} snapshot={snapshot} />;
}

function SectionedView({
  sections,
  snapshot,
}: {
  sections: { title: string; rows: { label: string; key: string }[] }[];
  snapshot: Record<string, unknown>;
}) {
  return (
    <>
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {section.rows.map(({ label, key }) => {
                const value = snapshot[key];
                if (value === undefined || value === null) return null;
                return (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground">{formatValue(value)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function GenericSnapshotView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const entries = Object.entries(snapshot).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== "object",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filing Data</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{humanize(key)}</span>
              <span className="font-medium text-foreground">{formatValue(value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (Math.abs(value) >= 1) {
      return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(value);
    }
    return String(value);
  }
  return String(value);
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
