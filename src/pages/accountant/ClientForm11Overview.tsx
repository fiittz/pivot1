import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useClientForm11Data } from "@/hooks/accountant/useClientForm11Data";
import { useClientDirectorOnboarding } from "@/hooks/accountant/useClientData";
import { User, AlertTriangle, FileText } from "lucide-react";

interface ClientForm11OverviewProps {
  clientUserId: string | null | undefined;
}

const ClientForm11Overview = ({ clientUserId }: ClientForm11OverviewProps) => {
  const { data: directorRows, isLoading: directorsLoading } = useClientDirectorOnboarding(clientUserId);

  const directors = (directorRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const data = r.onboarding_data as Record<string, unknown> | undefined;
    return {
      number: r.director_number as number,
      name: (data?.director_name as string) ?? `Director ${r.director_number}`,
    };
  });

  if (directorsLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading director data...</div>;
  }

  if (directors.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="font-medium">No director onboarding data found</p>
          <p className="text-sm mt-1">
            The client needs to complete the director wizard before Form 11 data can be calculated.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {directors.map((dir) => (
        <DirectorCard
          key={dir.number}
          clientUserId={clientUserId}
          directorNumber={dir.number}
          directorName={dir.name}
        />
      ))}
    </div>
  );
};

function DirectorCard({
  clientUserId,
  directorNumber,
  directorName,
}: {
  clientUserId: string | null | undefined;
  directorNumber: number;
  directorName: string;
}) {
  const { input, result, isLoading, taxYear } = useClientForm11Data(clientUserId, directorNumber);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">{directorName}</CardTitle>
            <p className="text-sm text-muted-foreground">Director {directorNumber} · {taxYear}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!result || !input) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <CardTitle className="text-base">{directorName}</CardTitle>
            <p className="text-sm text-muted-foreground">Director {directorNumber} · {taxYear}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Incomplete onboarding data — cannot compute Form 11.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasReliefs =
    input.pensionContributions > 0 ||
    input.medicalExpenses > 0 ||
    input.rentPaid > 0 ||
    input.charitableDonations > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{directorName}</CardTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Director {directorNumber}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Form 11 · Tax year {taxYear}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Income Summary */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Income</h4>
          <div className="space-y-1.5 text-sm">
            <Row label="Schedule E (Salary + Dividends + BIK)" amount={result.scheduleE} />
            <Row label="Schedule D (Business Profit)" amount={result.scheduleD} />
            {result.rentalProfit > 0 && <Row label="Rental Income" amount={result.rentalProfit} />}
            {result.foreignIncome > 0 && <Row label="Foreign Income" amount={result.foreignIncome} />}
            {result.otherIncome > 0 && <Row label="Other Income" amount={result.otherIncome} />}
            <Row label="Total Gross Income" amount={result.totalGrossIncome} bold />
          </div>
        </div>

        {/* Reliefs Detected */}
        {hasReliefs && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reliefs Detected</h4>
            <div className="space-y-1.5 text-sm">
              {input.pensionContributions > 0 && (
                <Row label="Pension Contributions" amount={input.pensionContributions} />
              )}
              {input.medicalExpenses > 0 && (
                <Row label="Medical Expenses" amount={input.medicalExpenses} />
              )}
              {input.rentPaid > 0 && (
                <Row label="Rent Relief" amount={input.rentPaid} />
              )}
              {input.charitableDonations > 0 && (
                <Row label="Charitable Donations" amount={input.charitableDonations} />
              )}
            </div>
          </div>
        )}

        {/* Tax Calculation */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tax Calculation</h4>
          <div className="space-y-1.5 text-sm">
            <Row label="Income Tax" amount={result.netIncomeTax} />
            <Row label="USC" amount={result.totalUSC} />
            <Row label="PRSI" amount={result.prsiPayable} />
            {result.cgtPayable > 0 && <Row label="CGT" amount={result.cgtPayable} />}
            <div className="border-t border-border pt-1.5 mt-1.5">
              <Row label="Total Liability" amount={result.totalLiability} bold />
            </div>
            {result.preliminaryTaxPaid > 0 && (
              <Row label="Less: Preliminary Tax Paid" amount={-result.preliminaryTaxPaid} />
            )}
            <Row label="Balance Due" amount={result.balanceDue} bold />
          </div>
        </div>

        {/* Warnings & Notes */}
        {(result.warnings.length > 0 || result.notes.length > 0) && (
          <div>
            {result.warnings.length > 0 && (
              <div className="space-y-1">
                {result.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-600">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {result.notes.length > 0 && (
              <div className="space-y-1 mt-1">
                {result.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  const cls = bold ? "font-semibold" : "";
  return (
    <div className={`flex items-center justify-between py-0.5 ${cls}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${amount < 0 ? "text-emerald-600" : ""}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientForm11Overview;
