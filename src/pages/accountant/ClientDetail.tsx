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
import {
  ArrowLeft,
  Building2,
  Mail,
  KeyRound,
  Loader2,
  User,
  Wallet,
  FileText,
  Receipt,
  BarChart3,
  StickyNote,
  ListTodo,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

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

  const businessName = onboarding?.company_name ?? profile?.full_name ?? "Client";
  const email = profile?.email ?? "";

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
      <div className="max-w-6xl mx-auto space-y-6">
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
            </div>
          </div>
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
            <TabsTrigger value="overview" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <Receipt className="w-3.5 h-3.5" /> Documents
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Reports
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Notes
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5">
              <ListTodo className="w-3.5 h-3.5" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="filings" className="gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Filings
            </TabsTrigger>
            <TabsTrigger value="messages" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Messages
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            {taxView === "ct1" ? (
              <ClientCT1Overview ct1Data={ct1Data} isLoading={ct1Data.isLoading || profileLoading} />
            ) : (
              <ClientForm11Overview clientUserId={clientId} />
            )}
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions">
            <ClientTransactions
              clientUserId={clientId}
              accountantClientId={accountantClientId}
              accountType={hasBothAccountTypes ? (taxView === "ct1" ? "limited_company" : "directors_personal_tax") : undefined}
              isVatRegistered={!!onboarding?.vat_registered}
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

          {/* Filings */}
          <TabsContent value="filings">
            {accountantClientId && clientId ? (
              <ClientFilingsTab accountantClientId={accountantClientId} clientUserId={clientId} />
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
        </Tabs>
      </div>
    </AccountantLayout>
  );
};

export default ClientDetail;
