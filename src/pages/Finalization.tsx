import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, FileText, AlertTriangle, Receipt, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTransactions } from "@/hooks/useTransactions";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import { useDirectorOnboarding } from "@/hooks/useDirectorOnboarding";
import { useCT1Data } from "@/hooks/useCT1Data";
import ClientLayout from "@/components/layout/ClientLayout";
import {
  BusinessBankExportQuestionnaire,
  type QuestionnaireData,
} from "@/components/export";
import {
  DirectorExportQuestionnaire,
  type DirectorQuestionnaireData,
} from "@/components/export";

const Finalization = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const reportType = searchParams.get("type") || "ct1";
  const taxYear = parseInt(searchParams.get("year") || new Date().getFullYear().toString(), 10);

  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  const { data: onboarding } = useOnboardingSettings();
  const { transactions } = useTransactions();
  const { directors } = useDirectorOnboarding();
  const ct1Data = useCT1Data();

  // Fetch the finalization request
  const { data: request, isLoading } = useQuery({
    queryKey: ["finalization-request", user?.id, reportType, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finalization_requests")
        .select("*")
        .eq("user_id", user!.id)
        .eq("report_type", reportType)
        .eq("tax_year", taxYear)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate receipt coverage live
  const expenseTransactions = (transactions || []).filter((t: any) => t.type === "expense");
  const matchedReceipts = expenseTransactions.filter((t: any) => t.receipt_url);
  const unmatchedReceipts = expenseTransactions.filter((t: any) => !t.receipt_url);
  const uncategorised = expenseTransactions.filter(
    (t: any) => !t.category || t.category === "Uncategorised",
  );

  const coveragePercent = expenseTransactions.length > 0
    ? Math.round((matchedReceipts.length / expenseTransactions.length) * 100)
    : 0;

  // Save questionnaire answers
  const saveAnswers = useMutation({
    mutationFn: async (answers: Record<string, unknown>) => {
      const coverage = {
        total: expenseTransactions.length,
        matched: matchedReceipts.length,
        unmatched: unmatchedReceipts.length,
        uncategorised: uncategorised.length,
      };

      const missing = unmatchedReceipts.map((t: any) => ({
        transaction_id: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        category: t.category || "Uncategorised",
      }));

      const { error } = await supabase
        .from("finalization_requests")
        .update({
          status: "completed",
          questionnaire_data: answers,
          receipt_coverage: coverage,
          missing_receipts: missing,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user!.id)
        .eq("report_type", reportType)
        .eq("tax_year", taxYear);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Questionnaire submitted! Your accountant will be notified.");
      queryClient.invalidateQueries({ queryKey: ["finalization-request"] });
      setShowQuestionnaire(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const reportName = reportType === "ct1" ? "Corporation Tax (CT1)" : "Income Tax (Form 11)";
  const companyName = onboarding?.company_name || onboarding?.business_name || "your company";

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </ClientLayout>
    );
  }

  if (!request) {
    return (
      <ClientLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card rounded-2xl p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">No Finalization Needed</h2>
            <p className="text-muted-foreground">
              There's no pending questionnaire for your {taxYear} {reportName}.
              Your accountant will notify you when it's time.
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (request.status === "completed") {
    return (
      <ClientLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-card rounded-2xl p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Questionnaire Completed</h2>
            <p className="text-muted-foreground">
              You submitted your {taxYear} {reportName} finalization on{" "}
              {new Date(request.completed_at!).toLocaleDateString("en-IE")}.
              Your accountant is reviewing it.
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {taxYear} {reportName} Finalization
          </h1>
          <p className="text-muted-foreground">
            Confirm your details so your accountant can prepare and file your {reportName} for {companyName}.
          </p>
        </div>

        {/* Receipt Coverage Card */}
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Receipt Coverage</h3>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{expenseTransactions.length}</p>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{matchedReceipts.length}</p>
              <p className="text-xs text-muted-foreground">With Receipts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{unmatchedReceipts.length}</p>
              <p className="text-xs text-muted-foreground">Missing Receipts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{uncategorised.length}</p>
              <p className="text-xs text-muted-foreground">Uncategorised</p>
            </div>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {coveragePercent}% of expenses have receipts attached.
            {unmatchedReceipts.length > 0 && (
              <> You can still proceed — missing receipts will be flagged to your accountant.</>
            )}
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-card rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">What's Needed</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{expenseTransactions.length} transactions imported</span>
            </li>
            <li className="flex items-start gap-3">
              {coveragePercent >= 80 ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              )}
              <span className="text-sm">
                {coveragePercent}% receipt coverage
                {coveragePercent < 80 && " — upload more receipts for better coverage"}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm">Complete the finalization questionnaire below</span>
            </li>
          </ul>
        </div>

        {/* Action */}
        <div className="flex gap-3">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => setShowQuestionnaire(true)}
          >
            <FileText className="w-4 h-4 mr-2" />
            {request.status === "in_progress" ? "Continue Questionnaire" : "Start Questionnaire"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/receipts/bulk")}
          >
            <Receipt className="w-4 h-4 mr-2" />
            Upload Receipts
          </Button>
        </div>

        {/* CT1 Questionnaire */}
        {reportType === "ct1" && (
          <BusinessBankExportQuestionnaire
            open={showQuestionnaire}
            onOpenChange={setShowQuestionnaire}
            onComplete={(answers) => {
              saveAnswers.mutate(answers as unknown as Record<string, unknown>);
            }}
            accountName={companyName}
            periodStart={`${taxYear}-01-01`}
            periodEnd={`${taxYear}-12-31`}
            closingBalance={0}
            initialValues={request.questionnaire_data as any}
          />
        )}

        {/* Form 11 Questionnaire */}
        {reportType === "form11" && (
          <DirectorExportQuestionnaire
            open={showQuestionnaire}
            onOpenChange={setShowQuestionnaire}
            onComplete={(answers) => {
              saveAnswers.mutate(answers as unknown as Record<string, unknown>);
            }}
            directorName={directors?.[0]?.director_name || "Director"}
            directorIndex={0}
            annualSalary={directors?.[0]?.annual_salary || 0}
            assessmentBasis={directors?.[0]?.assessment_basis || "single"}
            initialValues={request.questionnaire_data as any}
          />
        )}
      </div>
    </ClientLayout>
  );
};

export default Finalization;
