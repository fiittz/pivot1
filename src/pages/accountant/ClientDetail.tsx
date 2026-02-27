import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientStatusBadge } from "@/components/accountant/ClientStatusBadge";
import { useClientProfile, useClientOnboardingSettings, useClientAccounts } from "@/hooks/accountant/useClientData";
import { useClientCT1Data } from "@/hooks/accountant/useClientCT1Data";
import { useAccountantClientByUserId } from "@/hooks/accountant/useAccountantClients";
import ClientTransactions from "./ClientTransactions";
import ClientDocuments from "./ClientDocuments";
import ClientReports from "./ClientReports";
import ClientNotesTab from "./ClientNotesTab";
import ClientTasksTab from "./ClientTasksTab";
import ClientFilingsTab from "./ClientFilingsTab";
import {
  ArrowLeft,
  Building2,
  Mail,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Receipt,
  BarChart3,
  StickyNote,
  ListTodo,
  ShieldCheck,
} from "lucide-react";

const ClientDetail = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: profile, isLoading: profileLoading } = useClientProfile(clientId);
  const { data: onboarding } = useClientOnboardingSettings(clientId);
  const { data: accounts } = useClientAccounts(clientId);
  const ct1Data = useClientCT1Data(clientId);
  const { data: accountantClient } = useAccountantClientByUserId(clientId);
  const accountantClientId = accountantClient?.id;

  const businessName = onboarding?.company_name ?? profile?.full_name ?? "Client";
  const email = profile?.email ?? "";

  const totalIncome = ct1Data.detectedIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = ct1Data.expenseSummary.allowable + ct1Data.expenseSummary.disallowed;

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
        </div>

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
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview">
            {ct1Data.isLoading || profileLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading client data...</div>
            ) : (
              <div className="space-y-4">
                {/* Financial summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold text-emerald-600">
                        {formatCurrency(totalIncome)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold text-red-600">
                        {formatCurrency(totalExpenses)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-semibold ${ct1Data.closingBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(ct1Data.closingBalance)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Income breakdown */}
                {ct1Data.detectedIncome.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Income by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ct1Data.detectedIncome.map((item) => (
                          <div key={item.category} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{item.category}</span>
                            <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Expense breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Expense Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Allowable</span>
                          <span className="font-medium text-emerald-600">
                            {formatCurrency(ct1Data.expenseSummary.allowable)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Disallowed</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(ct1Data.expenseSummary.disallowed)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {ct1Data.disallowedByCategory.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Disallowed by Category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          {ct1Data.disallowedByCategory.slice(0, 5).map((item) => (
                            <div key={item.category} className="flex justify-between">
                              <span className="text-muted-foreground truncate">{item.category}</span>
                              <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Flagged capital items */}
                {ct1Data.flaggedCapitalItems.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Flagged Capital Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {ct1Data.flaggedCapitalItems.map((item, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div>
                              <span className="text-foreground">{item.description}</span>
                              <span className="text-muted-foreground ml-2">{item.date}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Transactions */}
          <TabsContent value="transactions">
            <ClientTransactions clientUserId={clientId} />
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <ClientDocuments clientUserId={clientId} accountantClientId={accountantClientId} />
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports">
            <ClientReports clientUserId={clientId} />
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
        </Tabs>
      </div>
    </AccountantLayout>
  );
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientDetail;
