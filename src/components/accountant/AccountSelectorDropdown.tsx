import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AccountSelection } from "@/hooks/accountant/useAccountSelector";

interface AccountSelectorDropdownProps {
  selections: AccountSelection[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const TAX_SCOPE_BADGE: Record<string, { label: string; className: string }> = {
  ct1: { label: "CT1", className: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  form11: { label: "Form 11", className: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" },
  both: { label: "Both", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  excluded: { label: "Excluded", className: "bg-red-100 text-red-600 line-through dark:bg-red-950/50 dark:text-red-400" },
};

export function AccountSelectorDropdown({
  selections,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: AccountSelectorDropdownProps) {
  const selectedCount = selections.filter(s => s.selected).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Landmark className="w-3.5 h-3.5" />
          {selectedCount} of {selections.length} accounts
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Filter Accounts</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="text-xs text-primary hover:underline"
              type="button"
            >
              Select All
            </button>
            <span className="text-muted-foreground text-xs">/</span>
            <button
              onClick={onDeselectAll}
              className="text-xs text-primary hover:underline"
              type="button"
            >
              Deselect All
            </button>
          </div>
        </div>

        <Separator />

        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {selections.map((sel) => {
            const scopeBadge = TAX_SCOPE_BADGE[sel.taxScope] ?? TAX_SCOPE_BADGE.ct1;
            return (
              <label
                key={sel.accountId}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={sel.selected}
                  onCheckedChange={() => onToggle(sel.accountId)}
                />
                <span className="flex-1 text-sm truncate">{sel.accountName}</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 h-4 ${
                    sel.isCash
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  }`}
                >
                  {sel.isCash ? "Cash" : "Bank"}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 h-4 ${scopeBadge.className}`}
                >
                  {scopeBadge.label}
                </Badge>
              </label>
            );
          })}

          {selections.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No accounts found
            </p>
          )}
        </div>

        <Separator />

        <div className="p-2">
          <p className="text-[10px] text-muted-foreground text-center">
            Selected accounts are included in reports
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
