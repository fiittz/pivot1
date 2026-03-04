import { lazy, Suspense } from "react";
import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, RequireAuth } from "@/hooks/useAuth";
import { RequireAccountant } from "@/components/auth/RequireAccountant";
import { RequirePlatformAdmin } from "@/components/auth/RequirePlatformAdmin";
import { BackgroundTasksProvider } from "@/contexts/BackgroundTasksContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import BackgroundTasksStatus from "@/components/layout/BackgroundTasksStatus";
import ErrorBoundary from "@/components/ErrorBoundary";
import PostHogTracker from "@/components/PostHogTracker";

// Eagerly loaded — landing/login page (first thing users see)
import Welcome from "./pages/Welcome";
import NotFound from "./pages/NotFound";

// Retry wrapper for lazy imports — handles stale chunk 404s after deploys
function lazyWithRetry(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch((err) => {
      // If this looks like a chunk load failure, hard-reload once
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
        return new Promise(() => {}); // never resolves — page is reloading
      }
      sessionStorage.removeItem("chunk_reload");
      throw err;
    }),
  );
}

// Lazy-loaded page components — split into separate chunks
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const BookkeepingDashboard = lazyWithRetry(() => import("./pages/BookkeepingDashboard"));
const Invoices = lazyWithRetry(() => import("./pages/Invoices"));
const AddInvoice = lazyWithRetry(() => import("./pages/AddInvoice"));
const AddExpense = lazyWithRetry(() => import("./pages/AddExpense"));
const ReceiptScanner = lazyWithRetry(() => import("./pages/ReceiptScanner"));
const BankFeed = lazyWithRetry(() => import("./pages/BankFeed"));
const VATCentre = lazyWithRetry(() => import("./pages/VATCentre"));
const RCTCentre = lazyWithRetry(() => import("./pages/RCTCentre"));
const TaxCentre = lazyWithRetry(() => import("./pages/TaxCentre"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const BulkProcessor = lazyWithRetry(() => import("./pages/BulkProcessor"));
const Reports = lazyWithRetry(() => import("./pages/Reports"));
const ChartOfAccounts = lazyWithRetry(() => import("./pages/ChartOfAccounts"));
const OnboardingWizard = lazyWithRetry(() => import("./pages/OnboardingWizard"));
const DirectorOnboardingWizard = lazyWithRetry(() => import("./pages/DirectorOnboardingWizard"));
const Accounts = lazyWithRetry(() => import("./pages/Accounts"));
const AccountDetail = lazyWithRetry(() => import("./pages/AccountDetail"));
const BulkReceiptUpload = lazyWithRetry(() => import("./pages/BulkReceiptUpload"));
const Form11Return = lazyWithRetry(() => import("./pages/Form11Return"));
const CT1Return = lazyWithRetry(() => import("./pages/CT1Return"));
const BalanceSheet = lazyWithRetry(() => import("./pages/BalanceSheet"));
const ReliefScanner = lazyWithRetry(() => import("./pages/ReliefScanner"));
const TripClaimsManager = lazyWithRetry(() => import("./pages/TripClaimsManager"));
const ProfitAndLoss = lazyWithRetry(() => import("./pages/ProfitAndLoss"));
const AgedDebtors = lazyWithRetry(() => import("./pages/AgedDebtors"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const BookDemo = lazyWithRetry(() => import("./pages/BookDemo"));

// Admin pages (lazy-loaded)
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));

// Accountant pages (lazy-loaded)
const AccountantDashboard = lazyWithRetry(() => import("./pages/accountant/AccountantDashboard"));
const AccountantSettings = lazyWithRetry(() => import("./pages/accountant/AccountantSettings"));
const AccountantSignup = lazyWithRetry(() => import("./pages/accountant/AccountantSignup"));
const ClientList = lazyWithRetry(() => import("./pages/accountant/ClientList"));
const InviteClient = lazyWithRetry(() => import("./pages/accountant/InviteClient"));
const ClientDetail = lazyWithRetry(() => import("./pages/accountant/ClientDetail"));
const AccountantTasks = lazyWithRetry(() => import("./pages/accountant/AccountantTasks"));
const ClientFilingReview = lazyWithRetry(() => import("./pages/accountant/ClientFilingReview"));
const ClientSettings = lazyWithRetry(() => import("./pages/accountant/ClientSettings"));
const AcceptInvite = lazyWithRetry(() => import("./pages/AcceptInvite"));
const queryClient = new QueryClient();

const App = () => (
  <Sentry.ErrorBoundary fallback={<p>An unexpected error occurred. Please refresh the page.</p>}>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <AuthProvider>
                <PostHogTracker />
                <BackgroundTasksProvider>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Routes>
                      <Route path="/" element={<Welcome />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/demo" element={<BookDemo />} />
                      <Route
                        path="/onboarding"
                        element={
                          <RequireAuth>
                            <OnboardingWizard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/onboarding/director"
                        element={
                          <RequireAuth>
                            <DirectorOnboardingWizard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/dashboard"
                        element={
                          <RequireAuth>
                            <BookkeepingDashboard />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoices"
                        element={
                          <RequireAuth>
                            <Invoices />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoice"
                        element={
                          <RequireAuth>
                            <AddInvoice />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/invoice/:id"
                        element={
                          <RequireAuth>
                            <AddInvoice />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/expense"
                        element={
                          <RequireAuth>
                            <AddExpense />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/scanner"
                        element={
                          <RequireAuth>
                            <ReceiptScanner />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/receipts/bulk"
                        element={
                          <RequireAuth>
                            <BulkReceiptUpload />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/bank"
                        element={
                          <RequireAuth>
                            <BankFeed />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accounts"
                        element={
                          <RequireAuth>
                            <Accounts />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accounts/:accountId"
                        element={
                          <RequireAuth>
                            <AccountDetail />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/vat"
                        element={
                          <RequireAuth>
                            <VATCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/rct"
                        element={
                          <RequireAuth>
                            <RCTCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax"
                        element={
                          <RequireAuth>
                            <TaxCentre />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/form11/:directorNumber"
                        element={
                          <RequireAuth>
                            <Form11Return />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/ct1"
                        element={
                          <RequireAuth>
                            <CT1Return />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/balance-sheet"
                        element={
                          <RequireAuth>
                            <BalanceSheet />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/reliefs"
                        element={
                          <RequireAuth>
                            <ReliefScanner />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/tax/trips"
                        element={
                          <RequireAuth>
                            <TripClaimsManager />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports/pnl"
                        element={
                          <RequireAuth>
                            <ProfitAndLoss />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports/aged-debtors"
                        element={
                          <RequireAuth>
                            <AgedDebtors />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <RequireAuth>
                            <Settings />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/bulk"
                        element={
                          <RequireAuth>
                            <BulkProcessor />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/reports"
                        element={
                          <RequireAuth>
                            <Reports />
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/chart-of-accounts"
                        element={
                          <RequireAuth>
                            <ChartOfAccounts />
                          </RequireAuth>
                        }
                      />
                      {/* Admin routes — PIN-gated, no login required */}
                      <Route
                        path="/admin"
                        element={
                          <RequirePlatformAdmin>
                            <AdminDashboard />
                          </RequirePlatformAdmin>
                        }
                      />
                      {/* Accountant routes */}
                      <Route path="/accountant" element={<AccountantSignup />} />
                      <Route path="/accountant/signup" element={<AccountantSignup />} />
                      <Route
                        path="/accountant/dashboard"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <AccountantDashboard />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/settings"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <AccountantSettings />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/clients"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <ClientList />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/clients/invite"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <InviteClient />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/clients/:clientId"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <ClientDetail />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/tasks"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <AccountantTasks />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/client-settings"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <ClientSettings />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      <Route
                        path="/accountant/filings/:filingId"
                        element={
                          <RequireAuth>
                            <RequireAccountant>
                              <ClientFilingReview />
                            </RequireAccountant>
                          </RequireAuth>
                        }
                      />
                      {/* Public invite acceptance route */}
                      <Route
                        path="/invite/:token"
                        element={
                          <RequireAuth>
                            <AcceptInvite />
                          </RequireAuth>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                  <BackgroundTasksStatus />
                </BackgroundTasksProvider>
              </AuthProvider>
            </ErrorBoundary>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </Sentry.ErrorBoundary>
);

export default App;
