import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  FileText,
  Receipt,
  BookOpen,
  Scale,
  Landmark,
  HardHat,
  Settings,
  LogOut,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  ClipboardList,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingSettings } from "@/hooks/useOnboardingSettings";
import PenguinIcon from "@/components/PenguinIcon";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  hidden?: boolean;
}

interface SubNavItem {
  tab: string;
  label: string;
  icon: React.ElementType;
}

const BANK_SUB_TABS: SubNavItem[] = [
  { tab: "ledger", label: "Ledger", icon: BookOpen },
  { tab: "uploads", label: "Uploads", icon: FileSpreadsheet },
  { tab: "reports", label: "Reports", icon: BarChart3 },
];

const ClientSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signOut } = useAuth();
  const { data: onboarding } = useOnboardingSettings();

  const isRctIndustry = [
    "construction",
    "forestry",
    "meat_processing",
    "carpentry_joinery",
    "electrical",
    "plumbing_heating",
  ].includes(onboarding?.business_type || "");
  const showRct = isRctIndustry && onboarding?.rct_registered;

  const bookkeepingItems: NavItem[] = [
    { path: "/bank", label: "Transactions", icon: ArrowLeftRight },
    { path: "/receipts/bulk", label: "Receipts", icon: Receipt },
    { path: "/invoices", label: "Invoices", icon: FileText },
    { path: "/reconciliation", label: "Reconciliation", icon: Scale },
  ];

  const taxItems: NavItem[] = [
    { path: "/vat", label: "VAT", icon: Landmark },
    { path: "/rct", label: "RCT", icon: HardHat, hidden: !showRct },
    { path: "/tax", label: "Tax Centre", icon: Calculator },
  ];

  const insightsItems: NavItem[] = [
    { path: "/profit-and-loss", label: "Profit & Loss", icon: TrendingUp },
    { path: "/balance-sheet", label: "Balance Sheet", icon: ClipboardList },
    { path: "/chart-of-accounts", label: "Chart of Accounts", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/" || location.pathname === "/dashboard";
    }
    if (path === "/receipts/bulk") {
      return location.pathname.startsWith("/receipts");
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const isOnBank = location.pathname === "/bank";
  const currentTab = searchParams.get("tab") || "ledger";

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <div key={item.path}>
        <button
          type="button"
          onClick={() => {
            if (item.path === "/bank") {
              navigate("/bank?tab=ledger");
            } else {
              navigate(item.path);
            }
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            active
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {item.label}
        </button>

        {/* Sub-tabs for Transactions */}
        {item.path === "/bank" && isOnBank && (
          <div className="ml-4 mt-0.5 space-y-0.5">
            {BANK_SUB_TABS.map((sub) => {
              const SubIcon = sub.icon;
              const subActive = currentTab === sub.tab;
              return (
                <button
                  key={sub.tab}
                  type="button"
                  onClick={() => navigate(`/bank?tab=${sub.tab}`)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                    subActive
                      ? "text-foreground font-medium bg-secondary/60"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                  )}
                >
                  <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const SectionLabel = ({ children }: { children: string }) => (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
      {children}
    </p>
  );

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-card border-r border-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <PenguinIcon className="w-8 h-8" />
        <div>
          <span className="text-lg font-semibold text-foreground tracking-tight">Balnce</span>
          <span className="text-[9px] text-muted-foreground block -mt-0.5 font-['IBM_Plex_Mono'] uppercase tracking-widest">v2</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {/* Dashboard — standalone */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive("/dashboard")
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Dashboard
          </button>
        </div>

        {/* Bookkeeping */}
        <SectionLabel>Bookkeeping</SectionLabel>
        <div className="space-y-0.5">
          {bookkeepingItems.filter((i) => !i.hidden).map(renderNavItem)}
        </div>

        {/* Tax & Compliance */}
        <SectionLabel>Tax & Compliance</SectionLabel>
        <div className="space-y-0.5">
          {taxItems.filter((i) => !i.hidden).map(renderNavItem)}
        </div>

        {/* Insights */}
        <SectionLabel>Insights</SectionLabel>
        <div className="space-y-0.5">
          {insightsItems.filter((i) => !i.hidden).map(renderNavItem)}
        </div>
      </nav>

      {/* Bottom: Settings + Sign out */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            isActive("/settings")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
          )}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </button>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default ClientSidebar;
