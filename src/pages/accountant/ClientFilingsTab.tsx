import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  StatusPipelineTabs,
  TableActionBar,
} from "@/components/accountant/table";
import type { ColumnDef } from "@/components/accountant/table";
import type { PipelineTab } from "@/components/accountant/table";
import {
  useClientFilings,
  useCreateFiling,
} from "@/hooks/accountant/useFilingRecords";
import { useClientCT1Data } from "@/hooks/accountant/useClientCT1Data";
import { useClientForm11Data } from "@/hooks/accountant/useClientForm11Data";
import type { FilingRecord, FilingType, FilingStatus } from "@/types/accountant";
import {
  Plus,
  FileText,
  Calendar,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ClientFilingsTabProps {
  accountantClientId: string;
  clientUserId: string;
}

type TabFilter = "all" | FilingStatus;

const FILING_TYPES: { value: FilingType; label: string }[] = [
  { value: "ct1", label: "CT1 — Corporation Tax" },
  { value: "form11", label: "Form 11 — Income Tax" },
  { value: "vat3", label: "VAT3 — VAT Return" },
  { value: "rct_monthly", label: "RCT Monthly" },
  { value: "b1", label: "B1 — Annual Return" },
];

const FILING_TYPE_LABELS: Record<string, string> = {
  ct1: "CT1 — Corporation Tax",
  form11: "Form 11 — Income Tax",
  vat3: "VAT3 — VAT Return",
  rct_monthly: "RCT Monthly",
  b1: "B1 — Annual Return",
  annual_return: "Annual Return",
};

const STATUS_ICONS: Record<FilingStatus, React.ReactNode> = {
  draft: <Clock className="w-3.5 h-3.5 text-gray-400" />,
  in_review: <FileText className="w-3.5 h-3.5 text-blue-500" />,
  approved: <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />,
  filed: <Send className="w-3.5 h-3.5 text-purple-500" />,
  acknowledged: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
};

const STATUS_COLORS: Record<FilingStatus, string> = {
  draft: "bg-gray-500/10 text-gray-500",
  in_review: "bg-blue-500/10 text-blue-500",
  approved: "bg-emerald-500/10 text-emerald-500",
  filed: "bg-purple-500/10 text-purple-500",
  acknowledged: "bg-emerald-600/10 text-emerald-600",
};

const STATUS_LABELS: Record<FilingStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  filed: "Filed",
  acknowledged: "Acknowledged",
};

const ClientFilingsTab = ({ accountantClientId, clientUserId }: ClientFilingsTabProps) => {
  const navigate = useNavigate();
  const { data: filings = [], isLoading } = useClientFilings(accountantClientId);
  const createFiling = useCreateFiling();
  const ct1Data = useClientCT1Data(clientUserId);
  const form11Data = useClientForm11Data(clientUserId, 1);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FilingType>("ct1");
  const [tabFilter, setTabFilter] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;

  const filtered = filings.filter((f) => {
    if (tabFilter !== "all" && f.status !== tabFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const typeLabel = FILING_TYPE_LABELS[f.filing_type] ?? f.filing_type;
      if (!typeLabel.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statusCounts = filings.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const pipelineTabs: PipelineTab<TabFilter>[] = [
    { key: "all", label: "All", count: filings.length },
    { key: "draft", label: "Draft", count: statusCounts.draft || 0 },
    { key: "in_review", label: "In Review", count: statusCounts.in_review || 0 },
    { key: "approved", label: "Approved", count: statusCounts.approved || 0 },
    { key: "filed", label: "Filed", count: statusCounts.filed || 0 },
  ];

  const handleCreate = () => {
    let snapshot: Record<string, unknown> = {};

    if (selectedType === "ct1") {
      snapshot = {
        totalIncome: ct1Data.detectedIncome.reduce((s, i) => s + i.amount, 0),
        allowableExpenses: ct1Data.expenseSummary.allowable,
        disallowedExpenses: ct1Data.expenseSummary.disallowed,
        tradingProfit: ct1Data.closingBalance,
        incomeByCategory: ct1Data.detectedIncome,
        expenseByCategory: ct1Data.expenseByCategory,
        disallowedByCategory: ct1Data.disallowedByCategory,
        flaggedCapitalItems: ct1Data.flaggedCapitalItems,
        directorsLoanDebits: ct1Data.directorsLoanDebits,
        isConstructionTrade: ct1Data.isConstructionTrade,
        rctPrepayment: ct1Data.rctPrepayment,
        vehicleAsset: ct1Data.vehicleAsset,
      };
    } else if (selectedType === "form11" && form11Data.input && form11Data.result) {
      snapshot = {
        ...form11Data.input,
        totalGrossIncome: form11Data.result.totalGrossIncome,
        totalCredits: form11Data.result.totalCredits,
        totalLiability: form11Data.result.totalLiability,
        balanceDue: form11Data.result.balanceDue,
        netIncomeTax: form11Data.result.netIncomeTax,
        totalUSC: form11Data.result.totalUSC,
        prsiPayable: form11Data.result.prsiPayable,
      };
    }

    createFiling.mutate(
      {
        accountant_client_id: accountantClientId,
        client_user_id: clientUserId,
        filing_type: selectedType,
        tax_period_start: `${taxYear}-01-01`,
        tax_period_end: `${taxYear}-12-31`,
        questionnaire_snapshot: snapshot,
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          toast({ title: "Filing created" });
        },
      },
    );
  };

  const columns: ColumnDef<FilingRecord>[] = [
    {
      id: "status_icon",
      header: "",
      width: "w-10",
      accessorFn: (row) => STATUS_ICONS[row.status],
    },
    {
      id: "type",
      header: "Filing Type",
      width: "min-w-[200px]",
      accessorFn: (row) => (
        <span className="text-sm font-medium text-foreground">
          {FILING_TYPE_LABELS[row.filing_type] ?? row.filing_type}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "w-24",
      accessorFn: (row) => (
        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[row.status]}`}>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      id: "period",
      header: "Tax Period",
      width: "w-48",
      accessorFn: (row) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {row.tax_period_start} — {row.tax_period_end}
        </span>
      ),
    },
    {
      id: "approved",
      header: "Approved",
      width: "w-32",
      accessorFn: (row) =>
        row.approved_at ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            {new Date(row.approved_at).toLocaleDateString("en-IE")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{"\u2014"}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatusPipelineTabs
        tabs={pipelineTabs}
        activeTab={tabFilter}
        onTabChange={setTabFilter}
      />

      <TableActionBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search filings..."
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            size="sm"
            className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Filing
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/accountant/filings/${row.id}`)}
        emptyIcon={<FileText className="w-10 h-10 text-muted-foreground/40" />}
        emptyMessage="No filings yet"
        emptyDescription="Create one to start the review process."
      />

      {/* Create Filing Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Filing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Filing Type</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as FilingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILING_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {ft.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Tax year: {taxYear}. A snapshot of the client's current data will be captured.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={createFiling.isPending}
              className="border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white"
            >
              {createFiling.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientFilingsTab;
