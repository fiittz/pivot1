import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ClipboardList,
  Edit,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  User,
  Bot,
  Briefcase,
} from "lucide-react";
import { useClientAuditTrail } from "@/hooks/accountant/useAuditTrail";
import type { AuditEntityType, AuditEvent } from "@/services/auditTrailService";

interface AuditTrailPanelProps {
  clientUserId: string;
}

const ENTITY_TYPE_OPTIONS: { value: AuditEntityType; label: string }[] = [
  { value: "transaction", label: "Transactions" },
  { value: "category", label: "Categories" },
  { value: "journal_entry", label: "Journal Entries" },
  { value: "vat_rate", label: "VAT Rates" },
  { value: "filing", label: "Filings" },
  { value: "correction", label: "Corrections" },
];

const ACTION_ICONS: Record<string, React.ElementType> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  approve: ShieldCheck,
  reverse: RotateCcw,
};

const ACTOR_ROLE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  client: { icon: User, label: "Client", color: "bg-blue-500/10 text-blue-500" },
  accountant: { icon: Briefcase, label: "Accountant", color: "bg-emerald-500/10 text-emerald-500" },
  system: { icon: Bot, label: "System", color: "bg-purple-500/10 text-purple-500" },
};

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFullTimestamp(dateString: string): string {
  return new Date(dateString).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function buildDescription(event: AuditEvent): string {
  const entityLabel = event.entity_type.replace("_", " ");

  switch (event.action) {
    case "create":
      return `Created ${entityLabel}`;
    case "delete":
      return `Deleted ${entityLabel}`;
    case "approve":
      return `Approved ${entityLabel}`;
    case "reverse":
      return `Reversed ${entityLabel}`;
    case "update": {
      if (event.field_name && event.old_value && event.new_value) {
        return `Changed ${event.field_name} from "${event.old_value}" to "${event.new_value}"`;
      }
      if (event.field_name) {
        return `Updated ${event.field_name} on ${entityLabel}`;
      }
      return `Updated ${entityLabel}`;
    }
    default:
      return `${event.action} on ${entityLabel}`;
  }
}

const AuditTrailPanel = ({ clientUserId }: AuditTrailPanelProps) => {
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | undefined>(undefined);

  const filters = useMemo(
    () => ({ entityType: entityFilter }),
    [entityFilter],
  );

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useClientAuditTrail(clientUserId, filters);

  const events = data?.pages.flat() ?? [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-4 h-4 text-[#E8930C]" />
          <span className="font-semibold text-sm">Audit Trail</span>
          {events.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <Select
          value={entityFilter ?? "all"}
          onValueChange={(v) => setEntityFilter(v === "all" ? undefined : (v as AuditEntityType))}
        >
          <SelectTrigger className="w-[160px] h-7 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audit trail...
        </div>
      )}

      {error && (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          Failed to load audit trail: {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <div className="px-4 py-8 text-sm text-muted-foreground text-center">
          No audit events found
        </div>
      )}

      {events.length > 0 && (
        <TooltipProvider>
          <div className="divide-y max-h-[500px] overflow-y-auto">
            {events.map((event) => {
              const ActionIcon = ACTION_ICONS[event.action] || Edit;
              const roleConfig = ACTOR_ROLE_CONFIG[event.actor_role] || ACTOR_ROLE_CONFIG.system;
              const RoleIcon = roleConfig.icon;

              return (
                <div key={event.id} className="px-4 py-2.5 flex items-start gap-3">
                  {/* Action icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    <ActionIcon className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{buildDescription(event)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="secondary"
                        className={`text-[9px] px-1 py-0 gap-1 ${roleConfig.color}`}
                      >
                        <RoleIcon className="w-2.5 h-2.5" />
                        {roleConfig.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {event.entity_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5 cursor-default">
                        {formatRelativeTime(event.created_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">{formatFullTimestamp(event.created_at)}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="px-4 py-2 border-t bg-muted/20 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-xs"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuditTrailPanel;
