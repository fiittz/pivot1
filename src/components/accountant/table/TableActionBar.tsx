import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface TableActionBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selectedCount?: number;
  bulkActions?: React.ReactNode;
  actions?: React.ReactNode;
}

export function TableActionBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  selectedCount = 0,
  bulkActions,
  actions,
}: TableActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      {/* Left side: bulk actions */}
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <span className="text-xs font-medium text-muted-foreground">
              {selectedCount} selected
            </span>
            {bulkActions}
          </>
        )}
      </div>

      {/* Right side: search + custom actions */}
      <div className="flex items-center gap-2 ml-auto">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 h-8 w-56 text-sm bg-transparent border-border"
          />
        </div>
        {actions}
      </div>
    </div>
  );
}
