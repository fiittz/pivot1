import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Download } from "lucide-react";
import { useCROFilings, useCROCompany, useCROAnnualAccounts } from "@/hooks/accountant/useCRO";
import { assembleAbridgedAccountsData, type AbridgedAccountsInput } from "@/lib/reports/abridgedAccountsData";
import { generateAbridgedAccountsPdf } from "@/lib/reports/pdf/abridgedAccountsPdf";
import type { ReportMeta } from "@/lib/reports/types";
import type { AuditTrailSnapshot as AuditSnapshot } from "@/lib/cro/assembleAuditSnapshot";
import { toast } from "sonner";

interface CROFilingHistoryProps {
  croCompanyId: string;
  clientUserId?: string;
}

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

function filingStatusBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">Unknown</Badge>;
  const lower = status.toLowerCase();
  if (lower === "registered")
    return <Badge className="bg-green-100 text-green-700 border-green-200">{status}</Badge>;
  if (lower === "pending")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{status}</Badge>;
  if (lower === "rejected")
    return <Badge className="bg-red-100 text-red-700 border-red-200">{status}</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export function CROFilingHistory({ croCompanyId, clientUserId }: CROFilingHistoryProps) {
  const { data: filings, isLoading } = useCROFilings(croCompanyId);
  const { data: croCompany } = useCROCompany(clientUserId);
  const { data: allAccounts } = useCROAnnualAccounts(croCompanyId);

  const sortedFilings = [...(filings ?? [])].sort((a, b) => {
    const dateA = a.sub_received_date ? new Date(a.sub_received_date).getTime() : 0;
    const dateB = b.sub_received_date ? new Date(b.sub_received_date).getTime() : 0;
    return dateB - dateA;
  });

  // Check if a filing has downloadable accounts data for its year
  const hasAccountsForYear = (yearEnd: string | null): boolean => {
    if (!yearEnd || !allAccounts) return false;
    return allAccounts.some((a) => a.financial_year_end === yearEnd);
  };

  const handleDownloadFiling = (yearEnd: string) => {
    const accounts = allAccounts?.find((a) => a.financial_year_end === yearEnd);
    if (!accounts) {
      toast.error("No accounts data available for this year");
      return;
    }

    const notes = accounts.notes;
    const directorNames: string[] = [];

    // CROAccountNotes shape: notes.directors is Array<{name}>
    if (notes?.directors && Array.isArray(notes.directors)) {
      for (const d of notes.directors) {
        if (d.name) directorNames.push(d.name);
      }
    }

    // Fallback: AuditTrailSnapshot shape (when data_source is balnce_auto)
    if (directorNames.length === 0) {
      const snapshot = notes as unknown as AuditSnapshot | null;
      const drs = snapshot?.abridged_accounts?.directors_report?.directors_and_secretary;
      if (Array.isArray(drs)) {
        for (const d of drs) if (d.name) directorNames.push(d.name);
      }
      if (directorNames.length === 0 && Array.isArray(snapshot?.directors)) {
        for (const d of snapshot!.directors) {
          if (d.director_name) directorNames.push(d.director_name);
        }
      }
    }

    if (directorNames.length === 0) directorNames.push("Director");

    const secretaryName = notes?.secretary?.name
      ?? (notes as unknown as AuditSnapshot | null)?.abridged_accounts?.directors_report?.directors_and_secretary?.find((d) => d.role === "Secretary")?.name;

    const companyName = croCompany?.company_name ?? "Company";
    const croNumber = croCompany?.company_num ?? "";
    const address = [croCompany?.address_line1, croCompany?.address_line2, croCompany?.address_line3, croCompany?.address_line4, croCompany?.eircode].filter(Boolean).join(", ");
    const taxYear = new Date(yearEnd).getFullYear().toString();

    const dateLabel = new Date(yearEnd).toLocaleDateString("en-IE", {
      day: "numeric", month: "long", year: "numeric",
    });

    const abInput: AbridgedAccountsInput = {
      companyName,
      croNumber,
      registeredAddress: address,
      accountingYearEnd: dateLabel,
      directorNames,
      companySecretaryName: secretaryName,
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
      taxYear,
      generatedDate: new Date(),
      preparer: "Balnce",
    };

    try {
      generateAbridgedAccountsPdf(assembleAbridgedAccountsData(abInput, meta));
      toast.success("Filing PDF downloaded");
    } catch (err) {
      console.error("Filing PDF export failed:", err);
      toast.error(`Failed to generate PDF: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Filing History
          {!isLoading && sortedFilings.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({sortedFilings.length} filing{sortedFilings.length !== 1 ? "s" : ""})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading filings...</div>
        ) : sortedFilings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium">No filings found</p>
            <p className="text-xs mt-1">CRO filing history will appear here after syncing</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date Received</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts Year End</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilings.map((filing) => {
                  const canDownload = hasAccountsForYear(filing.acc_year_to_date);
                  return (
                    <TableRow key={filing.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(filing.sub_received_date)}
                      </TableCell>
                      <TableCell>{filing.sub_type_desc}</TableCell>
                      <TableCell>{filing.doc_type_desc ?? "\u2014"}</TableCell>
                      <TableCell>{filingStatusBadge(filing.sub_status_desc)}</TableCell>
                      <TableCell>{formatDate(filing.acc_year_to_date)}</TableCell>
                      <TableCell className="text-right">{filing.num_pages ?? "\u2014"}</TableCell>
                      <TableCell className="text-right">
                        {canDownload ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownloadFiling(filing.acc_year_to_date!)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-xs">\u2014</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
