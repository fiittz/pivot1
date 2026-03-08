import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FilingReviewPanel } from "@/components/accountant/FilingReviewPanel";
import { FilingApprovalDialog } from "@/components/accountant/FilingApprovalDialog";
import {
  useFilingRecord,
  useUpdateFiling,
  useApproveFiling,
} from "@/hooks/accountant/useFilingRecords";
import { useClientProfile, useClientOnboardingSettings } from "@/hooks/accountant/useClientData";
import type { FilingStatus } from "@/types/accountant";
import {
  ArrowLeft,
  ShieldCheck,
  Download,
  FileText,
  Clock,
  Send,
  CheckCircle2,
  Pencil,
  Receipt,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCopilotAnalysis } from "@/hooks/accountant/useCopilot";
import { useAccountantClientByUserId } from "@/hooks/accountant/useAccountantClients";
import CopilotPanel from "@/components/accountant/CopilotPanel";

// Import XML generators for client-side XML generation
import { buildCT1Xml } from "@/lib/reports/xml/ct1Xml";
import { buildForm11Xml } from "@/lib/reports/xml/form11Xml";
import { assembleCT1ReportData } from "@/lib/reports/ct1ReportData";
import { assembleForm11ReportData } from "@/lib/reports/form11ReportData";
import { saveXml } from "@/lib/reports/xmlHelpers";

const ClientFilingReview = () => {
  const { filingId } = useParams<{ filingId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: filing, isLoading } = useFilingRecord(filingId);
  const updateFiling = useUpdateFiling();
  const approveFiling = useApproveFiling();

  const clientUserId = filing?.client_user_id;
  const { data: profile } = useClientProfile(clientUserId);
  const { data: onboarding } = useClientOnboardingSettings(clientUserId);

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const queryClient = useQueryClient();

  // Co-pilot
  const { data: accountantClient } = useAccountantClientByUserId(clientUserId);
  const copilotEnabled = accountantClient?.copilot_enabled ?? false;

  const clientName = (onboarding?.company_name as string) ?? profile?.full_name ?? "Client";

  // Fetch finalization request for this client + filing type
  const taxYear = filing?.tax_period_start?.slice(0, 4);
  const { data: finalizationReq } = useQuery({
    queryKey: ["finalization-request", clientUserId, filing?.filing_type, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finalization_requests")
        .select("*")
        .eq("user_id", clientUserId!)
        .eq("report_type", filing!.filing_type)
        .eq("tax_year", parseInt(taxYear!, 10))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId && !!filing && !!taxYear,
  });

  // Co-pilot analysis
  const {
    data: copilotSuggestions = [],
    isLoading: copilotLoading,
    error: copilotError,
    refetch: refetchCopilot,
  } = useCopilotAnalysis(
    clientUserId,
    filing?.filing_type,
    taxYear ? parseInt(taxYear, 10) : undefined,
    copilotEnabled && !!filing,
  );

  // Send report to client via approve-client-report edge function
  const sendToClient = useMutation({
    mutationFn: async () => {
      const snapshot = filing!.questionnaire_snapshot || {};
      const { data, error } = await supabase.functions.invoke("approve-client-report", {
        body: {
          client_user_id: clientUserId,
          report_type: filing!.filing_type,
          tax_year: parseInt(taxYear!, 10),
          report_data: snapshot,
          notes: filing!.accountant_review_notes || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Report sent to client" });
      queryClient.invalidateQueries({ queryKey: ["filing-records"] });
      queryClient.invalidateQueries({ queryKey: ["client-reports"] });
    },
    onError: (err: Error) => {
      toast({ title: `Failed to send: ${err.message}`, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AccountantLayout>
        <div className="text-center py-12 text-muted-foreground">Loading filing...</div>
      </AccountantLayout>
    );
  }

  if (!filing) {
    return (
      <AccountantLayout>
        <div className="max-w-4xl mx-auto text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium">Filing not found</h3>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </AccountantLayout>
    );
  }

  const snapshot = filing.questionnaire_snapshot as Record<string, unknown> | null;
  const filingLabel = FILING_TYPE_LABELS[filing.filing_type] ?? filing.filing_type;
  const taxPeriod = `${filing.tax_period_start} — ${filing.tax_period_end}`;

  const handleMarkInReview = () => {
    updateFiling.mutate(
      {
        id: filing.id,
        accountant_client_id: filing.accountant_client_id,
        status: "in_review",
        accountant_reviewed: true,
      },
      { onSuccess: () => toast({ title: "Filing marked as In Review" }) },
    );
  };

  const handleSaveNotes = () => {
    updateFiling.mutate(
      {
        id: filing.id,
        accountant_client_id: filing.accountant_client_id,
        accountant_review_notes: reviewNotes,
      },
      {
        onSuccess: () => {
          setNotesEditing(false);
          toast({ title: "Notes saved" });
        },
      },
    );
  };

  const handleApprove = (notes: string) => {
    approveFiling.mutate(
      {
        id: filing.id,
        accountant_client_id: filing.accountant_client_id,
        review_notes: notes,
      },
      {
        onSuccess: () => {
          setApprovalOpen(false);
          toast({ title: "Filing approved" });
        },
      },
    );
  };

  /** Fire-and-forget: store XML in Supabase Storage for audit trail */
  const storeXmlForAudit = async (xml: string, filename: string) => {
    try {
      await supabase.functions.invoke("store-filing-xml", {
        body: { filing_id: filing.id, xml_content: xml, filename },
      });
    } catch {
      // Non-blocking — local download already succeeded
      console.warn("Failed to store XML for audit trail");
    }
  };

  const handleGenerateXml = () => {
    if (!snapshot) {
      toast({ title: "No snapshot data", variant: "destructive" });
      return;
    }

    const taxYear = filing.tax_period_start.slice(0, 4);
    const meta = {
      companyName: clientName,
      taxYear,
      generatedDate: new Date(),
    };

    try {
      let xml = "";
      let filename = "";

      if (filing.filing_type === "ct1") {
        // Build a minimal CT1Data-like object from snapshot
        const ct1Like = {
          detectedIncome: (snapshot.incomeByCategory as { category: string; amount: number }[]) ?? [],
          expenseByCategory: (snapshot.expenseByCategory as { category: string; amount: number }[]) ?? [],
          expenseSummary: {
            allowable: (snapshot.allowableExpenses as number) ?? 0,
            disallowed: (snapshot.disallowedExpenses as number) ?? 0,
          },
          disallowedByCategory: (snapshot.disallowedByCategory as { category: string; amount: number }[]) ?? [],
          detectedPayments: [],
          closingBalance: (snapshot.tradingProfit as number) ?? 0,
          flaggedCapitalItems: (snapshot.flaggedCapitalItems as { description: string; date: string; amount: number }[]) ?? [],
          vehicleAsset: snapshot.vehicleAsset as Record<string, unknown> | null,
          rctPrepayment: (snapshot.rctPrepayment as number) ?? 0,
          travelAllowance: 0,
          directorsLoanTravel: 0,
          directorsLoanDebits: (snapshot.directorsLoanDebits as number) ?? 0,
          netDirectorsLoan: -((snapshot.directorsLoanDebits as number) ?? 0),
          isConstructionTrade: (snapshot.isConstructionTrade as boolean) ?? false,
          isCloseCompany: true,
          isLoading: false,
          reEvaluationApplied: false,
          reEvaluationWarnings: [],
        };

        const reportData = assembleCT1ReportData(ct1Like as never, null, meta);
        xml = buildCT1Xml(reportData, {
          periodStart: filing.tax_period_start,
          periodEnd: filing.tax_period_end,
          companyRegNo: (onboarding?.company_registration_number as string) ?? "",
          taxRefNo: (onboarding?.tax_reference_number as string) ?? "",
          companyName: clientName,
          isCloseCompany: true,
          rctCredit: (snapshot.rctPrepayment as number) ?? 0,
        });
        filename = `CT1_${clientName.replace(/\s+/g, "_")}_${taxYear}.xml`;
        saveXml(xml, filename);
        toast({ title: "CT1 XML downloaded" });
      } else if (filing.filing_type === "form11") {
        const reportData = assembleForm11ReportData(
          snapshot as never,
          {
            totalGrossIncome: (snapshot.totalGrossIncome as number) ?? 0,
            totalCredits: (snapshot.totalCredits as number) ?? 0,
            totalLiability: (snapshot.totalLiability as number) ?? 0,
            balanceDue: (snapshot.balanceDue as number) ?? 0,
          } as never,
          meta,
        );
        xml = buildForm11Xml(reportData);
        filename = `Form11_${clientName.replace(/\s+/g, "_")}_${taxYear}.xml`;
        saveXml(xml, filename);
        toast({ title: "Form 11 XML downloaded" });
      } else {
        toast({ title: "XML generation not yet supported for this filing type", variant: "destructive" });
        return;
      }

      // Store a copy in Supabase Storage for audit trail (non-blocking)
      if (xml && filename) {
        storeXmlForAudit(xml, filename);
      }
    } catch (err) {
      console.error("XML generation error:", err);
      toast({ title: "Error generating XML", variant: "destructive" });
    }
  };

  return (
    <AccountantLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mt-1 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-foreground">{filingLabel}</h2>
              <FilingStatusBadge status={filing.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {clientName} · {taxPeriod}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {filing.status === "draft" && (
            <Button
              onClick={handleMarkInReview}
              disabled={updateFiling.isPending}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Mark as In Review
            </Button>
          )}
          {(filing.status === "draft" || filing.status === "in_review") && (
            <Button
              onClick={() => setApprovalOpen(true)}
              size="sm"
              className="gap-1.5 border border-emerald-600 bg-emerald-600/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-emerald-600 hover:bg-emerald-600 hover:text-white"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Approve
            </Button>
          )}
          {filing.status === "approved" && (
            <>
              <Button
                onClick={handleGenerateXml}
                size="sm"
                className="gap-1.5 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white"
              >
                <Download className="w-3.5 h-3.5" />
                Download XML
              </Button>
              <Button
                onClick={() => sendToClient.mutate()}
                disabled={sendToClient.isPending}
                size="sm"
                className="gap-1.5 border border-blue-600 bg-blue-600/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-blue-600 hover:bg-blue-600 hover:text-white"
              >
                {sendToClient.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send to Client
              </Button>
            </>
          )}
        </div>

        {/* Co-Pilot Suggestions */}
        {copilotEnabled && (
          <CopilotPanel
            suggestions={copilotSuggestions}
            isLoading={copilotLoading}
            error={copilotError as Error | null}
            onRefresh={() => refetchCopilot()}
          />
        )}

        {/* Receipt Coverage from Finalization Request */}
        {finalizationReq && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Client Filing Pack
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                {finalizationReq.status === "completed" ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 font-medium">
                      Questionnaire completed
                      {finalizationReq.completed_at && (
                        <span className="text-muted-foreground font-normal ml-1">
                          on {new Date(finalizationReq.completed_at).toLocaleDateString("en-IE")}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-amber-600 font-medium">
                      Questionnaire {finalizationReq.status === "in_progress" ? "in progress" : "sent — awaiting response"}
                    </span>
                  </>
                )}
              </div>

              {/* Receipt coverage stats */}
              {finalizationReq.receipt_coverage && (() => {
                const cov = finalizationReq.receipt_coverage as { total?: number; matched?: number; unmatched?: number; uncategorised?: number };
                const pct = cov.total ? Math.round(((cov.matched || 0) / cov.total) * 100) : 0;
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-3 text-center">
                      <div>
                        <p className="text-lg font-bold">{cov.total || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Expenses</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600">{cov.matched || 0}</p>
                        <p className="text-[10px] text-muted-foreground">With Receipts</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-amber-600">{cov.unmatched || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Missing</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-500">{cov.uncategorised || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Uncategorised</p>
                      </div>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct}% receipt coverage</p>
                  </div>
                );
              })()}

              {/* Missing receipts list */}
              {finalizationReq.missing_receipts && (finalizationReq.missing_receipts as any[]).length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />
                    {(finalizationReq.missing_receipts as any[]).length} transactions missing receipts
                  </summary>
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-1.5 font-medium">Date</th>
                          <th className="text-left p-1.5 font-medium">Description</th>
                          <th className="text-right p-1.5 font-medium">Amount</th>
                          <th className="text-left p-1.5 font-medium">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(finalizationReq.missing_receipts as any[]).map((m: any, i: number) => (
                          <tr key={i} className="border-t">
                            <td className="p-1.5 text-muted-foreground">{m.date}</td>
                            <td className="p-1.5">{m.description}</td>
                            <td className="p-1.5 text-right">{"\u20AC"}{Math.abs(m.amount).toFixed(2)}</td>
                            <td className="p-1.5 text-muted-foreground">{m.category}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Review notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Review Notes</CardTitle>
            {!notesEditing && (
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => {
                  setReviewNotes(filing.accountant_review_notes ?? "");
                  setNotesEditing(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {notesEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add review notes..."
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes} disabled={updateFiling.isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setNotesEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {filing.accountant_review_notes || "No notes added yet."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Snapshot review */}
        <FilingReviewPanel
          filingType={filing.filing_type}
          snapshot={snapshot}
          taxPeriodStart={filing.tax_period_start}
          taxPeriodEnd={filing.tax_period_end}
        />

        {/* Approval dialog */}
        <FilingApprovalDialog
          open={approvalOpen}
          onOpenChange={setApprovalOpen}
          filingType={filing.filing_type}
          clientName={clientName}
          taxPeriod={taxPeriod}
          onApprove={handleApprove}
          isApproving={approveFiling.isPending}
        />
      </div>
    </AccountantLayout>
  );
};

function FilingStatusBadge({ status }: { status: FilingStatus }) {
  const config: Record<FilingStatus, string> = {
    draft: "bg-gray-500/10 text-gray-500",
    in_review: "bg-blue-500/10 text-blue-500",
    approved: "bg-emerald-500/10 text-emerald-500",
    filed: "bg-purple-500/10 text-purple-500",
    acknowledged: "bg-emerald-600/10 text-emerald-600",
  };
  const labels: Record<FilingStatus, string> = {
    draft: "Draft",
    in_review: "In Review",
    approved: "Approved",
    filed: "Filed",
    acknowledged: "Acknowledged",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config[status]}`}>
      {labels[status]}
    </Badge>
  );
}

const FILING_TYPE_LABELS: Record<string, string> = {
  ct1: "CT1 — Corporation Tax",
  form11: "Form 11 — Income Tax",
  vat3: "VAT3 — VAT Return",
  rct_monthly: "RCT Monthly",
  b1: "B1 — Annual Return",
  annual_return: "Annual Return",
};

export default ClientFilingReview;
