import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/accountant/table";
import type { ColumnDef } from "@/components/accountant/table";
import AccountantLayout from "@/components/layout/AccountantLayout";
import { useInboundEmails, useInboundEmailStats } from "@/hooks/accountant/useInboundEmails";
import {
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  XCircle,
  MailQuestion,
} from "lucide-react";
import type { InboundEmail } from "@/types/accountant";

function formatCurrency(amount: unknown): string {
  const n = Number(amount);
  if (isNaN(n)) return "-";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Mail }> = {
  processed: { label: "Processed", variant: "default", icon: CheckCircle2 },
  pending: { label: "Pending", variant: "outline", icon: Clock },
  triaging: { label: "Triaging", variant: "outline", icon: Clock },
  extracting: { label: "Extracting", variant: "outline", icon: Clock },
  enriching: { label: "Enriching", variant: "outline", icon: Clock },
  ignored: { label: "Ignored", variant: "secondary", icon: XCircle },
  failed: { label: "Failed", variant: "destructive", icon: AlertTriangle },
  unmatched: { label: "Unmatched", variant: "destructive", icon: MailQuestion },
};

const routeConfig: Record<string, { label: string; color: string }> = {
  auto_filed: { label: "Auto-filed", color: "text-green-600 bg-green-50" },
  pending_review: { label: "Client Review", color: "text-amber-600 bg-amber-50" },
  accountant_queue: { label: "Your Review", color: "text-red-600 bg-red-50" },
};

const columns: ColumnDef<InboundEmail>[] = [
  {
    id: "created_at",
    header: "Received",
    accessorFn: (row) => (
      <span className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
    ),
  },
  {
    id: "from_address",
    header: "From",
    accessorFn: (row) => (
      <span className="text-xs truncate max-w-[180px] block">{row.from_address}</span>
    ),
  },
  {
    id: "subject",
    header: "Subject",
    accessorFn: (row) => (
      <span className="text-xs font-medium truncate max-w-[250px] block">
        {row.subject || "(no subject)"}
      </span>
    ),
  },
  {
    id: "triage_classification",
    header: "Type",
    accessorFn: (row) => {
      if (!row.triage_classification) return <span className="text-xs text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="text-[10px]">
          {row.triage_classification}
        </Badge>
      );
    },
  },
  {
    id: "extracted_data",
    header: "Amount",
    accessorFn: (row) => {
      const total = (row.extracted_data as Record<string, unknown>)?.total;
      if (!total) return <span className="text-xs text-muted-foreground">-</span>;
      return <span className="text-xs font-medium">{formatCurrency(total)}</span>;
    },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => {
      const cfg = statusConfig[row.status] ?? statusConfig.pending;
      const Icon = cfg.icon;
      return (
        <Badge variant={cfg.variant} className="text-[10px] gap-1">
          <Icon className="h-3 w-3" />
          {cfg.label}
        </Badge>
      );
    },
  },
  {
    id: "route",
    header: "Route",
    accessorFn: (row) => {
      if (!row.route) return <span className="text-xs text-muted-foreground">-</span>;
      const cfg = routeConfig[row.route];
      return (
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
          {cfg.label}
        </span>
      );
    },
  },
  {
    id: "attachment_count",
    header: "Files",
    accessorFn: (row) => (
      <span className="text-xs text-muted-foreground">
        {row.attachment_count > 0 ? `${row.attachment_count} file${row.attachment_count > 1 ? "s" : ""}` : "-"}
      </span>
    ),
  },
];

export default function InboundEmailDashboard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: emails = [], isLoading } = useInboundEmails(null, statusFilter);
  const { data: stats } = useInboundEmailStats();

  const statCards = [
    { label: "Auto-filed", value: stats?.auto_filed ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Client Review", value: stats?.pending_review ?? 0, icon: Clock, color: "text-amber-600" },
    { label: "Your Review", value: stats?.accountant_queue ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Unmatched", value: stats?.unmatched ?? 0, icon: MailQuestion, color: "text-purple-600" },
    { label: "Processing", value: stats?.processing ?? 0, icon: Mail, color: "text-blue-600" },
    { label: "Failed", value: stats?.failed ?? 0, icon: XCircle, color: "text-gray-400" },
  ];

  return (
    <AccountantLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbound Emails</h1>
          <p className="text-muted-foreground">
            Documents received via client email forwarding. Auto-processed by AI.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map((s) => (
            <Card key={s.label} className="cursor-pointer hover:shadow-sm transition-shadow">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter + Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Emails</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="ignored">Ignored</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="unmatched">Unmatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <DataTable
              columns={columns}
              data={emails}
              getRowId={(row) => row.id}
              isLoading={isLoading}
              emptyMessage="No inbound emails yet. Clients can forward emails to their unique @in.balnce.ie address."
            />
          </CardContent>
        </Card>
      </div>
    </AccountantLayout>
  );
}
