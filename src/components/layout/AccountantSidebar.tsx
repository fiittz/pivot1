import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  LogOut,
  ArrowLeft,
  BarChart3,
  Wallet,
  Receipt,
  FileText,
  StickyNote,
  ListTodo,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import PenguinIcon from "@/components/PenguinIcon";
import { useAccountantClientByUserId } from "@/hooks/accountant/useAccountantClients";
import { useClientOnboardingSettings } from "@/hooks/accountant/useClientData";
import { useAccountantTaskCounts } from "@/hooks/accountant/useClientTasks";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const CLIENT_SUB_TABS: { tab: string; label: string; icon: React.ElementType }[] = [
  { tab: "overview", label: "Overview", icon: BarChart3 },
  { tab: "transactions", label: "Transactions", icon: Wallet },
  { tab: "documents", label: "Documents", icon: Receipt },
  { tab: "reports", label: "Reports", icon: FileText },
  { tab: "notes", label: "Notes", icon: StickyNote },
  { tab: "tasks", label: "Tasks", icon: ListTodo },
  { tab: "filings", label: "Filings", icon: ShieldCheck },
];

const AccountantSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: taskCounts } = useAccountantTaskCounts();

  // Detect if we're inside a client detail page
  const clientMatch = location.pathname.match(/^\/accountant\/clients\/([^/]+)$/);
  const clientId = clientMatch?.[1];
  const isInvitePage = clientId === "invite";
  const isClientDetail = !!clientId && !isInvitePage;

  const { data: accountantClient } = useAccountantClientByUserId(isClientDetail ? clientId : undefined);
  const { data: onboarding } = useClientOnboardingSettings(isClientDetail ? clientId : undefined);
  const clientName = onboarding?.company_name ?? accountantClient?.client_name ?? "Client";

  // Parse current tab from URL search params
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || "overview";

  const openTaskCount = (taskCounts?.todo ?? 0) + (taskCounts?.in_progress ?? 0);

  const navItems: NavItem[] = [
    { path: "/accountant/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/accountant/clients", label: "Clients", icon: Users },
    { path: "/accountant/tasks", label: "Tasks", icon: CheckSquare, badge: openTaskCount || undefined },
    { path: "/accountant/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/accountant/dashboard") {
      return location.pathname === "/accountant" || location.pathname === "/accountant/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-card border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <PenguinIcon className="w-8 h-8" />
        <div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Balnce</span>
          <span className="text-[10px] text-muted-foreground block -mt-0.5 font-['IBM_Plex_Mono'] uppercase tracking-widest">
            Practice
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isClientDetail ? (
          <>
            {/* Back to Clients */}
            <button
              type="button"
              onClick={() => navigate("/accountant/clients")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              Back to Clients
            </button>

            {/* Client name */}
            <div className="px-3 py-1.5 mb-1">
              <p className="text-sm font-semibold text-foreground truncate">{clientName}</p>
            </div>

            {/* Client sub-nav */}
            {CLIENT_SUB_TABS.map((item) => {
              const active = currentTab === item.tab;
              const Icon = item.icon;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => navigate(`/accountant/clients/${clientId}?tab=${item.tab}`)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </>
        ) : (
          /* Standard nav */
          navItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
                {item.badge ? (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-semibold rounded-full bg-[#E8930C] text-white">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-border">
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default AccountantSidebar;
