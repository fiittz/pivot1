import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import PenguinIcon from "@/components/PenguinIcon";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { path: "/accountant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/accountant/clients", label: "Clients", icon: Users },
  { path: "/accountant/tasks", label: "Tasks", icon: CheckSquare },
  { path: "/accountant/settings", label: "Settings", icon: Settings },
];

const AccountantSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
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
            </button>
          );
        })}
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
