import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientCT1Data } from "@/hooks/accountant/useClientCT1Data";
import { useClientForm11Data } from "@/hooks/accountant/useClientForm11Data";
import { useClientDirectorOnboarding, useClientOnboardingSettings } from "@/hooks/accountant/useClientData";
import { FileText, Download, Building2, User } from "lucide-react";

interface ClientReportsProps {
  clientUserId: string | null | undefined;
}

const ClientReports = ({ clientUserId }: ClientReportsProps) => {
  const ct1Data = useClientCT1Data(clientUserId);
  const { data: directorRows } = useClientDirectorOnboarding(clientUserId);
  const { data: onboarding } = useClientOnboardingSettings(clientUserId);

  const companyName = (onboarding?.company_name as string) ?? "Company";
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;

  const directors = (directorRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const data = r.onboarding_data as Record<string, unknown> | undefined;
    return {
      number: r.director_number as number,
      name: (data?.director_name as string) ?? `Director ${r.director_number}`,
    };
  });

  return (
    <div className="space-y-4">
      {/* CT1 — Company Return */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="w-10 h-10 rounded-lg bg-[#E8930C]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#E8930C]" />
          </div>
          <div>
            <CardTitle className="text-base">CT1 — Corporation Tax Return</CardTitle>
            <p className="text-sm text-muted-foreground">
              {companyName} · Tax year {taxYear}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {ct1Data.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Gross Income</p>
                  <p className="font-semibold">
                    {formatCurrency(ct1Data.detectedIncome.reduce((s, i) => s + i.amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Allowable Expenses</p>
                  <p className="font-semibold text-emerald-600">
                    {formatCurrency(ct1Data.expenseSummary.allowable)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Disallowed</p>
                  <p className="font-semibold text-red-600">
                    {formatCurrency(ct1Data.expenseSummary.disallowed)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Net Position</p>
                  <p className="font-semibold">{formatCurrency(ct1Data.closingBalance)}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Full CT1 review and XML export will be available in the Filings tab (Phase 6).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form 11 — Director Returns */}
      {directors.length > 0 ? (
        directors.map((dir) => (
          <DirectorReportCard
            key={dir.number}
            clientUserId={clientUserId}
            directorNumber={dir.number}
            directorName={dir.name}
            taxYear={taxYear}
          />
        ))
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            No director onboarding data found for this client.
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function DirectorReportCard({
  clientUserId,
  directorNumber,
  directorName,
  taxYear,
}: {
  clientUserId: string | null | undefined;
  directorNumber: number;
  directorName: string;
  taxYear: number;
}) {
  const { result, isLoading } = useClientForm11Data(clientUserId, directorNumber);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <CardTitle className="text-base">Form 11 — {directorName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Director {directorNumber} · Tax year {taxYear}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !result ? (
          <p className="text-sm text-muted-foreground">
            Incomplete onboarding data — cannot compute Form 11.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Gross Income</p>
                <p className="font-semibold">{formatCurrency(result.totalGrossIncome)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tax Credits</p>
                <p className="font-semibold text-emerald-600">{formatCurrency(result.totalCredits)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Liability</p>
                <p className="font-semibold text-red-600">{formatCurrency(result.totalLiability)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Balance Due</p>
                <p className="font-semibold">
                  {formatCurrency(result.balanceDue)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Full Form 11 review and XML export will be available in the Filings tab (Phase 6).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientReports;
