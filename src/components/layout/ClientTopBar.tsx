import { useLocation, useSearchParams } from "react-router-dom";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const BREADCRUMB_MAP: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/bank": "Transactions",
  "/invoices": "Invoices",
  "/expense": "Expenses",
  "/chart-of-accounts": "Chart of Accounts",
  "/reconciliation": "Reconciliation",
  "/vat": "VAT",
  "/rct": "RCT",
  "/tax": "Tax Centre",
  "/profit-and-loss": "Profit & Loss",
  "/balance-sheet": "Balance Sheet",
  "/settings": "Settings",
  "/receipts": "Receipts",
};

const TAB_LABELS: Record<string, string> = {
  ledger: "Ledger",
  uploads: "Uploads",
  reports: "Reports",
};

const ClientTopBar = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();

  const currentTab = searchParams.get("tab") || "ledger";

  // Build breadcrumbs
  let breadcrumbs: string[];
  const matchedPath = Object.keys(BREADCRUMB_MAP).find(
    (path) => location.pathname === path || location.pathname.startsWith(path + "/"),
  );

  if (matchedPath) {
    breadcrumbs = [BREADCRUMB_MAP[matchedPath]];
    if (matchedPath === "/bank" && currentTab !== "ledger") {
      breadcrumbs.push(TAB_LABELS[currentTab] || currentTab);
    }
  } else {
    breadcrumbs = ["Dashboard"];
  }

  const initials = (profile?.email as string)?.charAt(0)?.toUpperCase() || "U";

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0">
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

export default ClientTopBar;
