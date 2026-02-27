import { useLocation } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const BREADCRUMB_MAP: Record<string, string> = {
  "/accountant/dashboard": "Dashboard",
  "/accountant/clients": "Clients",
  "/accountant/clients/invite": "Invite Client",
  "/accountant/tasks": "Tasks",
  "/accountant/settings": "Practice Settings",
};

// Dynamic routes that need prefix matching
const DYNAMIC_BREADCRUMBS: [RegExp, string][] = [
  [/^\/accountant\/clients\/[^/]+$/, "Client Detail"],
  [/^\/accountant\/filings\/[^/]+$/, "Filing Review"],
];

const AccountantTopBar = () => {
  const location = useLocation();
  const { profile } = useAuth();

  // Find matching breadcrumb (exact, prefix, or dynamic match)
  const pageTitle =
    BREADCRUMB_MAP[location.pathname] ||
    Object.entries(BREADCRUMB_MAP).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ||
    DYNAMIC_BREADCRUMBS.find(([re]) => re.test(location.pathname))?.[1] ||
    "Dashboard";

  const initials = (profile?.email as string)?.charAt(0)?.toUpperCase() || "A";

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Breadcrumb */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
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
