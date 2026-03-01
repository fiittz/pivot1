import { useLocation } from "react-router-dom";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAccountantClientByUserId } from "@/hooks/accountant/useAccountantClients";
import { useClientOnboardingSettings } from "@/hooks/accountant/useClientData";

const BREADCRUMB_MAP: Record<string, string> = {
  "/accountant/dashboard": "Dashboard",
  "/accountant/clients": "Clients",
  "/accountant/clients/invite": "Invite Client",
  "/accountant/tasks": "Tasks",
  "/accountant/settings": "Practice Settings",
};

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  transactions: "Transactions",
  documents: "Documents",
  reports: "Reports",
  notes: "Notes",
  tasks: "Tasks",
  filings: "Filings",
};

const AccountantTopBar = () => {
  const location = useLocation();
  const { profile } = useAuth();

  // Detect client detail page
  const clientMatch = location.pathname.match(/^\/accountant\/clients\/([^/]+)$/);
  const clientId = clientMatch?.[1];
  const isInvitePage = clientId === "invite";
  const isClientDetail = !!clientId && !isInvitePage;

  const { data: accountantClient } = useAccountantClientByUserId(isClientDetail ? clientId : undefined);
  const { data: onboarding } = useClientOnboardingSettings(isClientDetail ? clientId : undefined);
  const clientName = onboarding?.company_name ?? accountantClient?.client_name ?? "Client";

  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || "overview";

  // Build breadcrumb
  let breadcrumbs: string[];
  if (isClientDetail) {
    breadcrumbs = ["Clients", clientName, TAB_LABELS[currentTab] || "Overview"];
  } else if (location.pathname.match(/^\/accountant\/filings\/[^/]+$/)) {
    breadcrumbs = ["Filing Review"];
  } else {
    const title =
      BREADCRUMB_MAP[location.pathname] ||
      Object.entries(BREADCRUMB_MAP).find(([path]) =>
        location.pathname.startsWith(path),
      )?.[1] ||
      "Dashboard";
    breadcrumbs = [title];
  }

  const initials = (profile?.email as string)?.charAt(0)?.toUpperCase() || "A";

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />}
            <span
              className={
                i === breadcrumbs.length - 1
                  ? "text-lg font-semibold text-foreground"
                  : "text-sm text-muted-foreground"
              }
            >
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Search className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="w-4 h-4" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-[#E8930C]/10 border border-[#E8930C]/30 flex items-center justify-center text-sm font-medium text-[#E8930C]">
          {initials}
        </div>
      </div>
    </header>
  );
};

export default AccountantTopBar;
