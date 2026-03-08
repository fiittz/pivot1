import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ClientStatusBadge } from "@/components/accountant/ClientStatusBadge";
import { useClientProfile, useClientOnboardingSettings, useClientAccounts } from "@/hooks/accountant/useClientData";
import { useClientCT1Data } from "@/hooks/accountant/useClientCT1Data";
import { useAccountantClientByUserId } from "@/hooks/accountant/useAccountantClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ClientCT1Overview from "./ClientCT1Overview";
import ClientForm11Overview from "./ClientForm11Overview";
import ClientTransactions from "./ClientTransactions";
import ClientDocuments from "./ClientDocuments";
import ClientReports from "./ClientReports";
import ClientNotesTab from "./ClientNotesTab";
import ClientTasksTab from "./ClientTasksTab";
import ClientFilingsTab from "./ClientFilingsTab";
import ClientMessagesTab from "@/components/accountant/ClientMessagesTab";
import AuditTrailPanel from "@/components/accountant/AuditTrailPanel";
import { TrialBalanceView } from "@/components/accountant/TrialBalanceView";
import { MultiYearComparison } from "@/components/accountant/MultiYearComparison";
import { ProfitAndLossView } from "@/components/accountant/ProfitAndLossView";
import { DebtorCreditorWorkingPaper } from "@/components/accountant/DebtorCreditorWorkingPaper";
import { ClientReadinessBar } from "@/components/accountant/ClientReadinessBar";
import { FixedAssetRegister } from "@/components/accountant/FixedAssetRegister";
import { BankReconciliationView } from "@/components/accountant/BankReconciliationView";
import { OnboardingChecklist } from "@/components/accountant/OnboardingChecklist";
import { VATReturnsView } from "@/components/accountant/VATReturnsView";
import { PayrollTab } from "@/components/accountant/PayrollTab";
import { CapTableView } from "@/components/accountant/CapTableView";
import { PaymentsOverview } from "@/components/accountant/PaymentsOverview";
import { RCTManager } from "@/components/accountant/RCTManager";
import {
  ArrowLeft,
  Building2,
  Mail,
  KeyRound,
  Loader2,
  User,
  Wallet,
  Inbox,
  Copy,
  Sparkles,
} from "lucide-react";
import { useToggleCopilot } from "@/hooks/accountant/useCopilot";
import { Switch } from "@/components/ui/switch";

type TaxView = "ct1" | "form11";

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  const [taxView, setTaxView] = useState<TaxView>("ct1");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const { data: profile, isLoading: profileLoading } = useClientProfile(clientId);
  const { data: onboarding } = useClientOnboardingSettings(clientId);
  const { data: accounts } = useClientAccounts(clientId);
  const ct1Data = useClientCT1Data(clientId);
  const { data: accountantClient } = useAccountantClientByUserId(clientId);
  const accountantClientId = accountantClient?.id;

  const toggleCopilot = useToggleCopilot();
  const copilotEnabled = accountantClient?.copilot_enabled ?? false;

  const businessName = onboarding?.company_name ?? profile?.full_name ?? "Client";
  const email = profile?.email ?? "";

  // Build the client's inbound email address
  const inboundEmailCode = accountantClient?.inbound_email_code;
  const inboundEmail = inboundEmailCode
    ? `${(accountantClient?.client_name || "client").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/(?:^-|-$)/g, "")}-${inboundEmailCode}@in.balnce.ie`
    : null;

  // Show toggle only when client has both company and personal tax accounts
  const hasBothAccountTypes = useMemo(() => {
    if (!accounts) return false;
    const hasCompany = accounts.some((a) => (a as Record<string, unknown>).account_type === "limited_company");
    const hasPersonal = accounts.some((a) => (a as Record<string, unknown>).account_type === "directors_personal_tax");
    return hasCompany && hasPersonal;
  }, [accounts]);

  const handleSendPasswordReset = async () => {
    if (!email) {
      toast.error("No email address found for this client");
      return;
    }
    setIsSendingReset(true);
    try {
      await supabase.functions.invoke("send-password-reset", {
        body: { email, origin: window.location.origin },
      });
      toast.success("Password reset email sent to client");
    } catch {
      toast.error("Failed to send password reset email");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <AccountantLayout>
      <div className="max-w-full space-y-6">
        {/* Back button + header */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/accountant/clients")}
            className="mt-1 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground truncate">{businessName}</h2>
              <ClientStatusBadge status="active" />
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              {email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" /> {email}
                </span>
              )}
              {onboarding?.business_type && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {onboarding.business_type}
                </span>
              )}
              {accounts && (
                <span className="flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" /> {accounts.length} account{accounts.length !== 1 ? "s" : ""}
                </span>
              )}
              {inboundEmail && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inboundEmail);
                    toast.success("Inbound email copied");
                  }}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  title="Click to copy inbound email"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span className="font-mono text-xs">{inboundEmail}</span>
                  <Copy className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {accountantClientId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <Sparkles className={`w-3.5 h-3.5 ${copilotEnabled ? "text-[#E8930C]" : "text-muted-foreground"}`} />
                <span className="text-xs text-muted-foreground">Co-Pilot</span>
                <Switch
                  checked={copilotEnabled}
                  onCheckedChange={(checked) =>
                    toggleCopilot.mutate({ accountantClientId, enabled: checked })
                  }
                  disabled={toggleCopilot.isPending}
                />
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendPasswordReset}
              disabled={isSendingReset || !email}
              className="shrink-0 gap-1.5"
            >
              {isSendingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
              Send Password Reset
            </Button>
          </div>
        </div>

        {/* Tax view toggle — only when client has both account types */}
        {hasBothAccountTypes && (
          <ToggleGroup
            type="single"
            value={taxView}
            onValueChange={(v) => { if (v) setTaxView(v as TaxView); }}
            variant="outline"
            size="sm"
            className="justify-start"
          >
            <ToggleGroupItem value="ct1" className="gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" /> CT1
            </ToggleGroupItem>
            <ToggleGroupItem value="form11" className="gap-1.5 text-xs">
              <User className="w-3.5 h-3.5" /> Form 11
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
            <TabsTrigger value="aged-debtors">Debtors &amp; Creditors</TabsTrigger>
            <TabsTrigger value="comparison">Year Comparison</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="bank-rec">Bank Rec</TabsTrigger>
            <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
            <TabsTrigger value="cap-table">Cap Table</TabsTrigger>
            <TabsTrigger value="vat">VAT</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            {onboarding?.rct_registered && <TabsTrigger value="rct">RCT</TabsTrigger>}
            <TabsTrigger value="filings">Filings</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            <div className="space-y-6">
              <ClientReadinessBar clientUserId={clientId} />
              {taxView === "ct1" ? (
                <ClientCT1Overview ct1Data={ct1Data} isLoading={ct1Data.isLoading || profileLoading} />
              ) : (
                <ClientForm11Overview clientUserId={clientId} />
              )}
            </div>
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions">
            <ClientTransactions
              clientUserId={clientId}
              accountantClientId={accountantClientId}
              accountType={hasBothAccountTypes ? (taxView === "ct1" ? "limited_company" : "directors_personal_tax") : undefined}
              isVatRegistered={!!onboarding?.vat_registered}
              isRctRegistered={!!onboarding?.rct_registered}
              initialCategoryFilter={searchParams.get("category") ?? undefined}
              onClearCategoryFilter={() => setSearchParams({ tab: "transactions" }, { replace: true })}
            />
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <ClientDocuments clientUserId={clientId} accountantClientId={accountantClientId} />
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports">
            <ClientReports clientUserId={clientId} taxView={taxView} />
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes">
            {accountantClientId ? (
              <ClientNotesTab accountantClientId={accountantClientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Tasks */}
          <TabsContent value="tasks">
            {accountantClientId ? (
              <ClientTasksTab accountantClientId={accountantClientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Trial Balance */}
          <TabsContent value="trial-balance">
            {accountantClientId && clientId ? (
              <TrialBalanceView
                clientUserId={clientId}
                accountantClientId={accountantClientId}
                taxYear={new Date().getFullYear() - 1}
                clientName={profile?.business_name ?? accountantClient?.client_name}
                onDrillDown={(accountName) => {
                  setSearchParams({ tab: "transactions", category: accountName }, { replace: true });
                }}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* P&L */}
          <TabsContent value="pnl">
            {clientId ? (
              <ProfitAndLossView
                clientUserId={clientId}
                taxYear={new Date().getFullYear() - 1}
                clientName={profile?.business_name ?? accountantClient?.client_name}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Debtors & Creditors */}
          <TabsContent value="aged-debtors">
            {clientId && accountantClientId ? (
              <DebtorCreditorWorkingPaper
                clientUserId={clientId}
                accountantClientId={accountantClientId}
                taxYear={new Date().getFullYear() - 1}
                clientName={profile?.business_name ?? accountantClient?.client_name}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Year Comparison */}
          <TabsContent value="comparison">
            {clientId ? (
              <MultiYearComparison
                clientUserId={clientId}
                currentTaxYear={new Date().getFullYear() - 1}
                clientName={profile?.business_name ?? accountantClient?.client_name}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Fixed Assets */}
          <TabsContent value="assets">
            {clientId ? (
              <FixedAssetRegister clientUserId={clientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Bank Reconciliation */}
          <TabsContent value="bank-rec">
            {clientId ? (
              <BankReconciliationView
                clientUserId={clientId}
                taxYear={new Date().getFullYear() - 1}
                clientName={profile?.business_name ?? accountantClient?.client_name}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Onboarding */}
          <TabsContent value="onboarding">
            {accountantClientId ? (
              <OnboardingChecklist accountantClientId={accountantClientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Cap Table */}
          <TabsContent value="cap-table">
            {clientId ? (
              <CapTableView clientUserId={clientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* VAT */}
          <TabsContent value="vat">
            {clientId ? (
              <VATReturnsView
                clientUserId={clientId}
                taxYear={new Date().getFullYear() - 1}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Payroll */}
          <TabsContent value="payroll">
            {clientId ? (
              <PayrollTab
                clientUserId={clientId}
                taxYear={new Date().getFullYear() - 1}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* RCT — only for construction, forestry, meat processing clients */}
          {onboarding?.rct_registered && (
            <TabsContent value="rct">
              {clientId && accountantClientId ? (
                <RCTManager
                  clientUserId={clientId}
                  accountantClientId={accountantClientId}
                  clientName={businessName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )}
            </TabsContent>
          )}

          {/* Filings */}
          <TabsContent value="filings">
            {accountantClientId && clientId ? (
              <ClientFilingsTab accountantClientId={accountantClientId} clientUserId={clientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments">
            {clientId ? (
              <PaymentsOverview clientUserId={clientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Messages */}
          <TabsContent value="messages">
            {accountantClientId ? (
              <ClientMessagesTab accountantClientId={accountantClientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>

          {/* Audit */}
          <TabsContent value="audit">
            {clientId ? (
              <AuditTrailPanel clientUserId={clientId} />
            ) : (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AccountantLayout>
  );
};

export default ClientDetail;
