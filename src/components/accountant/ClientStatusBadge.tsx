import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/types/accountant";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ClientStatus, { label: string; className: string }> = {
  pending_invite: {
    label: "Pending Invite",
    className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  suspended: {
    label: "Suspended",
    className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
  },
};

interface ClientStatusBadgeProps {
  status: ClientStatus;
  className?: string;
}

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending_invite;

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
