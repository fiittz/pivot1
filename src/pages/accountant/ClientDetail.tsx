import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CROTab } from "@/components/accountant/CROTab";
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
  LayoutDashboard,
  ArrowRightLeft,
  FileText,
  Calculator,
  Scale,
  CreditCard,
  ClipboardCheck,
  Shield,
  MessageSquare,
  History,
  Users,
  HardHat,
  BarChart3,
  Receipt,
  Landmark,
  BookOpen,
  PieChart,
  TrendingUp,
  Package,
  Banknote,
} from "lucide-react";
import { useToggleCopilot } from "@/hooks/accountant/useCopilot";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type TaxView = "ct1" | "form11";

// ── Navigation structure ─────────────────────────────────────────────────────

interface NavItem {
  value: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function buildNavGroups(showRCT: boolean): NavGroup[] {
  return [
    {
      label: "General",
      items: [
        { value: "overview", label: "Overview", icon: LayoutDashboard },
        { value: "transactions", label: "Transactions", icon: ArrowRightLeft },
        { value: "documents", label: "Documents", icon: FileText },
        { value: "onboarding", label: "Onboarding", icon: ClipboardCheck },
      ],
    },
    {
      label: "Accounts",
      items: [
        { value: "trial-balance", label: "Trial Balance", icon: Scale },
        { value: "pnl", label: "P&L", icon: BarChart3 },
        { value: "bank-rec", label: "Bank Rec", icon: Landmark },
        { value: "aged-debtors", label: "Working Papers", icon: BookOpen },
        { value: "comparison", label: "Year Comparison", icon: TrendingUp },
        { value: "assets", label: "Fixed Assets", icon: Package },
      ],
    },
    {
      label: "Tax & Compliance",
      items: [
        { value: "vat", label: "VAT Returns", icon: Receipt },
        { value: "filings", label: "Filings", icon: FileText },
        ...(showRCT
          ? [{ value: "rct", label: "RCT", icon: HardHat }]
          : []),
        { value: "cro", label: "CRO / Annual Return", icon: Building2 },
      ],
    },
    {
      label: "People & Pay",
      items: [
        { value: "payroll", label: "Payroll", icon: Users },
        { value: "cap-table", label: "Cap Table", icon: PieChart },
        { value: "payments", label: "Payments", icon: CreditCard },
      ],
    },
    {
      label: "Practice",
      items: [
        { value: "reports", label: "Reports", icon: Calculator },
        { value: "notes", label: "Notes", icon: MessageSquare },
        { value: "tasks", label: "Tasks", icon: ClipboardCheck },
        { value: "messages", label: "Messages", icon: Mail },
        { value: "audit", label: "Audit Trail", icon: History },
      ],
    },
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

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

  const inboundEmailCode = accountantClient?.inbound_email_code;
  const inboundEmail = inboundEmailCode
    ? `${(accountantClient?.client_name || "client").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/(?:^-|-$)/g, "")}-${inboundEmailCode}@in.balnce.ie`
    : null;

  const hasBothAccountTypes = useMemo(() => {
    if (!accounts) return false;
    const hasCompany = accounts.some((a) => (a as Record<string, unknown>).account_type === "limited_company");
    const hasPersonal = accounts.some((a) => (a as Record<string, unknown>).account_type === "directors_personal_tax");
    return hasCompany && hasPersonal;
  }, [accounts]);

  const showRCT = !!onboarding?.rct_registered;
  const navGroups = useMemo(() => buildNavGroups(showRCT), [showRCT]);

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

  const taxYear = new Date().getFullYear() - 1;
  const clientName = profile?.business_name ?? accountantClient?.client_name;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AccountantLayout>
      <div className="max-w-full space-y-4">
        {/* ── Header ──────────────────────────────────────────────────── */}
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
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

        {/* ── Tax view toggle ─────────────────────────────────────────── */}
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

        {/* ── Sidebar + Content layout ─────────────────────────────── */}
        <div className="flex gap-6">
          {/* Sidebar navigation */}
          <nav className="w-48 shrink-0 space-y-5 hidden md:block">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5 px-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => setActiveTab(item.value)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Mobile dropdown nav (shown on small screens) */}
          <div className="md:hidden w-full mb-4">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {navGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Content area */}
          <div className="flex-1 min-w-0">
            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <ClientReadinessBar clientUserId={clientId} />
                {taxView === "ct1" ? (
                  <ClientCT1Overview ct1Data={ct1Data} isLoading={ct1Data.isLoading || profileLoading} />
                ) : (
                  <ClientForm11Overview clientUserId={clientId} />
                )}
              </div>
            )}

            {/* Transactions */}
            {activeTab === "transactions" && (
              <ClientTransactions
                clientUserId={clientId}
                accountantClientId={accountantClientId}
                accountType={hasBothAccountTypes ? (taxView === "ct1" ? "limited_company" : "directors_personal_tax") : undefined}
                isVatRegistered={!!onboarding?.vat_registered}
                isRctRegistered={!!onboarding?.rct_registered}
                initialCategoryFilter={searchParams.get("category") ?? undefined}
                onClearCategoryFilter={() => setSearchParams({ tab: "transactions" }, { replace: true })}
              />
            )}

            {/* Documents */}
            {activeTab === "documents" && (
              <ClientDocuments clientUserId={clientId} accountantClientId={accountantClientId} />
            )}

            {/* Reports */}
            {activeTab === "reports" && (
              <ClientReports clientUserId={clientId} taxView={taxView} />
            )}

            {/* Notes */}
            {activeTab === "notes" && (
              accountantClientId ? (
                <ClientNotesTab accountantClientId={accountantClientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Tasks */}
            {activeTab === "tasks" && (
              accountantClientId ? (
                <ClientTasksTab accountantClientId={accountantClientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Trial Balance */}
            {activeTab === "trial-balance" && (
              accountantClientId && clientId ? (
                <TrialBalanceView
                  clientUserId={clientId}
                  accountantClientId={accountantClientId}
                  taxYear={taxYear}
                  clientName={clientName}
                  onDrillDown={(accountName) => {
                    setSearchParams({ tab: "transactions", category: accountName }, { replace: true });
                  }}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* P&L */}
            {activeTab === "pnl" && (
              clientId ? (
                <ProfitAndLossView
                  clientUserId={clientId}
                  taxYear={taxYear}
                  clientName={clientName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Debtors & Creditors Working Papers */}
            {activeTab === "aged-debtors" && (
              clientId && accountantClientId ? (
                <DebtorCreditorWorkingPaper
                  clientUserId={clientId}
                  accountantClientId={accountantClientId}
                  taxYear={taxYear}
                  clientName={clientName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Year Comparison */}
            {activeTab === "comparison" && (
              clientId ? (
                <MultiYearComparison
                  clientUserId={clientId}
                  currentTaxYear={taxYear}
                  clientName={clientName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Fixed Assets */}
            {activeTab === "assets" && (
              clientId ? (
                <FixedAssetRegister clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Bank Reconciliation */}
            {activeTab === "bank-rec" && (
              clientId ? (
                <BankReconciliationView
                  clientUserId={clientId}
                  taxYear={taxYear}
                  clientName={clientName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Onboarding */}
            {activeTab === "onboarding" && (
              accountantClientId ? (
                <OnboardingChecklist accountantClientId={accountantClientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Cap Table */}
            {activeTab === "cap-table" && (
              clientId ? (
                <CapTableView clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* VAT Returns */}
            {activeTab === "vat" && (
              clientId ? (
                <VATReturnsView
                  clientUserId={clientId}
                  taxYear={taxYear}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Payroll */}
            {activeTab === "payroll" && (
              clientId ? (
                <PayrollTab
                  clientUserId={clientId}
                  taxYear={taxYear}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* RCT */}
            {activeTab === "rct" && showRCT && (
              clientId && accountantClientId ? (
                <RCTManager
                  clientUserId={clientId}
                  accountantClientId={accountantClientId}
                  clientName={businessName}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* CRO / Annual Return */}
            {activeTab === "cro" && (
              clientId ? (
                <CROTab clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Filings */}
            {activeTab === "filings" && (
              accountantClientId && clientId ? (
                <ClientFilingsTab accountantClientId={accountantClientId} clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Payments */}
            {activeTab === "payments" && (
              clientId ? (
                <PaymentsOverview clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Messages */}
            {activeTab === "messages" && (
              accountantClientId ? (
                <ClientMessagesTab accountantClientId={accountantClientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}

            {/* Audit Trail */}
            {activeTab === "audit" && (
              clientId ? (
                <AuditTrailPanel clientUserId={clientId} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">Loading...</div>
              )
            )}
          </div>
        </div>
      </div>
    </AccountantLayout>
  );
};

export default ClientDetail;
