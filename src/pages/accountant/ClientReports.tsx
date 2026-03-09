import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientCT1Data } from "@/hooks/accountant/useClientCT1Data";
import { useClientForm11Data } from "@/hooks/accountant/useClientForm11Data";
import {
  useClientDirectorOnboarding,
  useClientOnboardingSettings,
  useClientTransactions,
  useClientInvoices,
} from "@/hooks/accountant/useClientData";
import { assembleCT1ReportData } from "@/lib/reports/ct1ReportData";
import { assembleForm11ReportData } from "@/lib/reports/form11ReportData";
import { assembleVATReportData } from "@/lib/reports/vatReportData";
import { buildCT1Xml } from "@/lib/reports/xml/ct1Xml";
import { buildForm11Xml } from "@/lib/reports/xml/form11Xml";
import { buildVATXml } from "@/lib/reports/xml/vatXml";
import { buildRCTXml, type RCTSubcontractor, type RCTSummary } from "@/lib/reports/xml/rctXml";
import { saveXml } from "@/lib/reports/xmlHelpers";
import { generateCT1Pdf } from "@/lib/reports/pdf/ct1Pdf";
import { generateForm11Pdf } from "@/lib/reports/pdf/form11Pdf";
import { generateAbridgedAccountsPdf } from "@/lib/reports/pdf/abridgedAccountsPdf";
import { assembleAbridgedAccountsData, type AbridgedAccountsInput } from "@/lib/reports/abridgedAccountsData";
import { useQuestionnaire } from "@/hooks/useQuestionnaire";
import { FileText, Download, Building2, User, Receipt, Landmark, FileDown } from "lucide-react";

interface ClientReportsProps {
  clientUserId: string | null | undefined;
  taxView?: "ct1" | "form11";
}

const ClientReports = ({ clientUserId, taxView }: ClientReportsProps) => {
  const ct1Data = useClientCT1Data(clientUserId);
  const { data: directorRows } = useClientDirectorOnboarding(clientUserId);
  const { data: onboarding } = useClientOnboardingSettings(clientUserId);

  const companyName = (onboarding?.company_name as string) ?? "Company";
  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
  const startDate = `${taxYear}-01-01`;
  const endDate = `${taxYear}-12-31`;

  const directors = (directorRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const data = r.onboarding_data as Record<string, unknown> | undefined;
    return {
      number: r.director_number as number,
      name: (data?.director_name as string) ?? `Director ${r.director_number}`,
    };
  });

  // ── CT1 questionnaire data (for abridged accounts) ────────
  const { data: ct1Questionnaire } = useQuestionnaire("ct1", String(taxYear), clientUserId ?? undefined);

  // ── VAT data from transactions ──────────────────────────────
  const { data: incomeTransactions } = useClientTransactions(clientUserId, {
    type: "income", startDate, endDate,
  });
  const { data: expenseTransactions } = useClientTransactions(clientUserId, {
    type: "expense", startDate, endDate,
  });

  const vatSummary = useMemo(() => {
    const incTxns = incomeTransactions ?? [];
    const expTxns = expenseTransactions ?? [];

    let vatOnSales = 0;
    let vatOnPurchases = 0;
    const salesByRate: Record<string, { net: number; vat: number }> = {};
    const purchasesByRate: Record<string, { net: number; vat: number }> = {};

    for (const txn of incTxns) {
      const t = txn as Record<string, unknown>;
      const vatAmt = Number(t.vat_amount) || 0;
      const rate = String(t.vat_rate || "0%");
      vatOnSales += vatAmt;
      if (!salesByRate[rate]) salesByRate[rate] = { net: 0, vat: 0 };
      salesByRate[rate].net += Math.abs(Number(t.amount) || 0);
      salesByRate[rate].vat += vatAmt;
    }

    for (const txn of expTxns) {
      const t = txn as Record<string, unknown>;
      const vatAmt = Number(t.vat_amount) || 0;
      const rate = String(t.vat_rate || "0%");
      vatOnPurchases += vatAmt;
      if (!purchasesByRate[rate]) purchasesByRate[rate] = { net: 0, vat: 0 };
      purchasesByRate[rate].net += Math.abs(Number(t.amount) || 0);
      purchasesByRate[rate].vat += vatAmt;
    }

    return {
      vatOnSales,
      vatOnPurchases,
      netVat: vatOnSales - vatOnPurchases,
      salesByRate: Object.entries(salesByRate).map(([rate, v]) => ({ rate, ...v })),
      purchasesByRate: Object.entries(purchasesByRate).map(([rate, v]) => ({ rate, ...v })),
    };
  }, [incomeTransactions, expenseTransactions]);

  // ── RCT data from invoices ──────────────────────────────────
  const { data: invoices } = useClientInvoices(clientUserId);

  const rctSummary = useMemo(() => {
    const invs = invoices ?? [];
    let totalDeducted = 0;
    let rctCount = 0;
    const byRate: Record<number, { count: number; gross: number; deducted: number }> = {};
    const subcontractors: RCTSubcontractor[] = [];

    for (const inv of invs) {
      const i = inv as Record<string, unknown>;
      let notes: Record<string, unknown> | null = null;
      try {
        notes = typeof i.notes === "string" ? JSON.parse(i.notes) : (i.notes as Record<string, unknown>);
      } catch { /* plain text */ }
      if (!notes?.rct_enabled) continue;

      const rctRate = Number(notes.rct_rate) || 0;
      const rctAmount = Number(notes.rct_amount) || 0;
      const gross = Math.abs(Number(i.total_amount ?? i.amount) || 0);

      totalDeducted += rctAmount;
      rctCount++;

      if (!byRate[rctRate]) byRate[rctRate] = { count: 0, gross: 0, deducted: 0 };
      byRate[rctRate].count++;
      byRate[rctRate].gross += gross;
      byRate[rctRate].deducted += rctAmount;

      const customer = i.customer as Record<string, unknown> | null;
      subcontractors.push({
        taxRef: "", // Not available from invoice data
        name: (customer?.name as string) ?? "Unknown",
        grossPayment: gross,
        taxDeducted: rctAmount,
        rctRate,
      });
    }

    return {
      totalDeducted,
      rctCount,
      byRate,
      subcontractors,
    };
  }, [invoices]);

  // ── XML export handlers ─────────────────────────────────────

  const meta = {
    companyName,
    taxYear: String(taxYear),
    generatedDate: new Date(),
  };

  const getCT1ReportData = () => {
    return assembleCT1ReportData(ct1Data as never, null, meta);
  };

  const handleCT1Xml = () => {
    try {
      const reportData = getCT1ReportData();
      const xml = buildCT1Xml(reportData, {
        periodStart: startDate,
        periodEnd: endDate,
        companyRegNo: (onboarding?.company_registration_number as string) ?? "",
        taxRefNo: (onboarding?.tax_reference_number as string) ?? "",
        companyName,
        isCloseCompany: true,
        rctCredit: ct1Data.rctPrepayment ?? 0,
      });
      saveXml(xml, `CT1_${companyName.replace(/\s+/g, "_")}_${taxYear}.xml`);
    } catch (err) {
      console.error("CT1 XML error:", err);
    }
  };

  const handleCT1Pdf = () => {
    try {
      const reportData = getCT1ReportData();
      generateCT1Pdf(reportData);
    } catch (err) {
      console.error("CT1 PDF error:", err);
    }
  };

  const handleVATXml = () => {
    try {
      const vatInput = {
        vatNumber: (onboarding?.vat_number as string) ?? "",
        vatBasis: (onboarding?.vat_basis as string) ?? "cash_basis",
        periodStart: startDate,
        periodEnd: endDate,
        salesByRate: vatSummary.salesByRate,
        purchasesByRate: vatSummary.purchasesByRate,
      };
      const reportData = assembleVATReportData(vatInput, meta);
      const xml = buildVATXml(reportData, {
        vatNumber: (onboarding?.vat_number as string) ?? "",
        periodStart: startDate,
        periodEnd: endDate,
      });
      saveXml(xml, `VAT3_${companyName.replace(/\s+/g, "_")}_${taxYear}.xml`);
    } catch (err) {
      console.error("VAT XML error:", err);
    }
  };

  const handleRCTXml = () => {
    try {
      const summary: RCTSummary = {
        totalGrossPayments: rctSummary.subcontractors.reduce((s, sc) => s + sc.grossPayment, 0),
        totalTaxDeducted: rctSummary.totalDeducted,
        subcontractors: rctSummary.subcontractors,
      };
      const xml = buildRCTXml(summary, {
        principalTaxRef: (onboarding?.tax_reference_number as string) ?? "",
        principalName: companyName,
        month: new Date().getMonth() + 1,
        year: taxYear,
      });
      saveXml(xml, `RCT_${companyName.replace(/\s+/g, "_")}_${taxYear}.xml`);
    } catch (err) {
      console.error("RCT XML error:", err);
    }
  };

  const isVatRegistered = !!(onboarding?.vat_registered);
  const isRctRegistered = !!(onboarding?.rct_registered);

  // ── CRO Abridged Accounts PDF ─────────────────────────────
  const handleAbridgedPdf = () => {
    try {
      const input: AbridgedAccountsInput = {
        companyName,
        croNumber: (onboarding?.company_registration_number as string) ?? "",
        registeredAddress: (onboarding?.registered_address as string) ?? "",
        accountingYearEnd: `31 December ${taxYear}`,
        directorNames: directors.map((d) => d.name),
        companySecretaryName: directors.length === 1 ? directors[0].name : undefined,
        fixedAssetsTangible: 0,
        stock: 0,
        wip: 0,
        debtors: 0,
        prepayments: 0,
        accruedIncome: 0,
        cashAtBank: 0,
        creditors: 0,
        accruals: 0,
        deferredIncome: 0,
        taxation: 0,
        bankLoans: 0,
        directorsLoans: 0,
        shareCapital: 100,
        retainedProfits: 0,
      };

      // Populate from CT1 questionnaire data (fetched from Supabase)
      if (ct1Questionnaire) {
        const q = ct1Questionnaire as Record<string, number | undefined>;
        input.fixedAssetsTangible =
          (q.fixedAssetsPlantMachinery ?? 0) +
          (q.fixedAssetsMotorVehicles ?? 0) +
          (q.fixedAssetsFixturesFittings ?? 0) +
          (q.fixedAssetsLandBuildings ?? 0);
        input.stock = q.currentAssetsStock ?? 0;
        input.debtors = q.currentAssetsDebtors ?? q.tradeDebtorsTotal ?? 0;
        input.cashAtBank = q.currentAssetsBankBalance ?? 0;
        input.prepayments = q.prepaymentsAmount ?? 0;
        input.accruedIncome = q.accruedIncomeAmount ?? 0;
        input.creditors = q.liabilitiesCreditors ?? q.tradeCreditorsTotal ?? 0;
        input.accruals = q.accrualsAmount ?? 0;
        input.deferredIncome = q.deferredIncomeAmount ?? 0;
        input.taxation = q.liabilitiesTaxation ?? 0;
        input.bankLoans = q.liabilitiesBankLoans ?? 0;
        input.directorsLoans = q.liabilitiesDirectorsLoans ?? 0;
        input.shareCapital = q.shareCapital ?? 100;
        // Derive retained profits as balancing figure
        const totalAssets = input.fixedAssetsTangible + input.stock + input.debtors + input.cashAtBank + input.prepayments + input.accruedIncome;
        const totalLiabilities = input.creditors + input.accruals + input.deferredIncome + input.taxation + input.bankLoans + input.directorsLoans;
        input.retainedProfits = totalAssets - totalLiabilities - input.shareCapital;
      }

      const reportData = assembleAbridgedAccountsData(input, meta);
      generateAbridgedAccountsPdf(reportData);
    } catch (err) {
      console.error("Abridged Accounts PDF error:", err);
    }
  };

  // ── CT1 Card ────────────────────────────────────────────────

  const ct1Section = (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-[#E8930C]/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-[#E8930C]" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">CT1 — Corporation Tax Return</CardTitle>
          <p className="text-sm text-muted-foreground">
            {companyName} · Tax year {taxYear}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={handleCT1Pdf} disabled={ct1Data.isLoading}>
            <FileDown className="w-4 h-4 mr-1.5" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleCT1Xml} disabled={ct1Data.isLoading}>
            <Download className="w-4 h-4 mr-1.5" />
            ROS XML
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {ct1Data.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );

  // ── Form 11 Cards ───────────────────────────────────────────

  const form11Section = directors.length > 0 ? (
    directors.map((dir) => (
      <DirectorReportCard
        key={dir.number}
        clientUserId={clientUserId}
        directorNumber={dir.number}
        directorName={dir.name}
        taxYear={taxYear}
        companyName={companyName}
        onboarding={onboarding}
      />
    ))
  ) : (
    <Card>
      <CardContent className="py-8 text-center text-muted-foreground">
        <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
        No director onboarding data found for this client.
      </CardContent>
    </Card>
  );

  // ── VAT Card ────────────────────────────────────────────────

  const vatSection = isVatRegistered ? (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">VAT3 — VAT Return</CardTitle>
          <p className="text-sm text-muted-foreground">
            {companyName} · Tax year {taxYear}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleVATXml}>
          <Download className="w-4 h-4 mr-1.5" />
          ROS XML
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">VAT on Sales (T1)</p>
            <p className="font-semibold">{formatCurrency(vatSummary.vatOnSales)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">VAT on Purchases (T3)</p>
            <p className="font-semibold text-emerald-600">{formatCurrency(vatSummary.vatOnPurchases)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">
              {vatSummary.netVat >= 0 ? "Net VAT Payable" : "Net VAT Refundable"}
            </p>
            <p className={`font-semibold ${vatSummary.netVat >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(Math.abs(vatSummary.netVat))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  // ── RCT Card ────────────────────────────────────────────────

  const rctSection = isRctRegistered ? (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">RCT — Relevant Contracts Tax</CardTitle>
          <p className="text-sm text-muted-foreground">
            {companyName} · Tax year {taxYear}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRCTXml} disabled={rctSummary.rctCount === 0}>
          <Download className="w-4 h-4 mr-1.5" />
          ROS XML
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Total RCT Deducted</p>
              <p className="font-semibold">{formatCurrency(rctSummary.totalDeducted)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">RCT Invoices</p>
              <p className="font-semibold">{rctSummary.rctCount}</p>
            </div>
          </div>
          {Object.keys(rctSummary.byRate).length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              {Object.entries(rctSummary.byRate).map(([rate, data]) => (
                <p key={rate}>
                  {rate}% rate: {data.count} invoice{data.count !== 1 ? "s" : ""} · {formatCurrency(data.deducted)} deducted
                </p>
              ))}
            </div>
          )}
          {rctSummary.rctCount === 0 && (
            <p className="text-xs text-muted-foreground">
              No RCT invoices found for this period.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-4">
      {taxView === "form11" ? (
        <>
          {form11Section}
          {ct1Section}
        </>
      ) : (
        <>
          {ct1Section}
          {form11Section}
        </>
      )}
      {vatSection}
      {rctSection}

      {/* CRO Abridged Accounts PDF */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">CRO — Abridged Accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              {companyName} · FYE 31 Dec {taxYear}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleAbridgedPdf}>
            <FileDown className="w-4 h-4 mr-1.5" />
            PDF
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            FRS 102 Section 1A abridged balance sheet, directors' responsibility statement,
            accounting policies, and notes. Upload to CRO CORE portal with B1 annual return.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Director Report Card ──────────────────────────────────────

function DirectorReportCard({
  clientUserId,
  directorNumber,
  directorName,
  taxYear,
  companyName,
  onboarding,
}: {
  clientUserId: string | null | undefined;
  directorNumber: number;
  directorName: string;
  taxYear: number;
  companyName: string;
  onboarding: Record<string, unknown> | null | undefined;
}) {
  const { input, result, isLoading } = useClientForm11Data(clientUserId, directorNumber);

  const getForm11ReportData = () => {
    const meta = {
      companyName,
      taxYear: String(taxYear),
      generatedDate: new Date(),
    };
    return assembleForm11ReportData(input!, result!, meta);
  };

  const handleForm11Xml = () => {
    if (!input || !result) return;
    try {
      const reportData = getForm11ReportData();
      const xml = buildForm11Xml(reportData);
      saveXml(xml, `Form11_${directorName.replace(/\s+/g, "_")}_${taxYear}.xml`);
    } catch (err) {
      console.error("Form 11 XML error:", err);
    }
  };

  const handleForm11Pdf = () => {
    if (!input || !result) return;
    try {
      const reportData = getForm11ReportData();
      generateForm11Pdf(reportData);
    } catch (err) {
      console.error("Form 11 PDF error:", err);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Form 11 — {directorName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Director {directorNumber} · Tax year {taxYear}
          </p>
        </div>
        {result && (
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" onClick={handleForm11Pdf}>
              <FileDown className="w-4 h-4 mr-1.5" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleForm11Xml}>
              <Download className="w-4 h-4 mr-1.5" />
              ROS XML
            </Button>
          </div>
        )}
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
                <p className="text-muted-foreground">Salary + Dividends</p>
                <p className="font-semibold">
                  {formatCurrency((input?.salary ?? 0) + (input?.dividends ?? 0))}
                </p>
                <p className="text-[10px] text-amber-600">From onboarding — verify</p>
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

            <p className="text-xs text-amber-600/80">
              Salary and dividends are sourced from onboarding defaults, not actual payroll. Verify before filing.
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
