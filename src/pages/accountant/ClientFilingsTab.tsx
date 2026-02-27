import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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

const FILING_TYPES: { value: FilingType; label: string }[] = [
  { value: "ct1", label: "CT1 — Corporation Tax" },
  { value: "form11", label: "Form 11 — Income Tax" },
  { value: "vat3", label: "VAT3 — VAT Return" },
  { value: "rct_monthly", label: "RCT Monthly" },
  { value: "b1", label: "B1 — Annual Return" },
];

const ClientFilingsTab = ({ accountantClientId, clientUserId }: ClientFilingsTabProps) => {
  const navigate = useNavigate();
  const { data: filings = [], isLoading } = useClientFilings(accountantClientId);
  const createFiling = useCreateFiling();
  const ct1Data = useClientCT1Data(clientUserId);
  const form11Data = useClientForm11Data(clientUserId, 1);
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<FilingType>("ct1");

  const now = new Date();
  const taxYear = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;

  const handleCreate = () => {
    // Build snapshot based on filing type
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {filings.length} filing{filings.length !== 1 ? "s" : ""}
        </h3>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="h-8 border border-[#E8930C] bg-[#E8930C]/10 font-['IBM_Plex_Mono'] text-xs uppercase tracking-widest text-[#E8930C] hover:bg-[#E8930C] hover:text-white gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Filing
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading filings...</div>
      ) : filings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">
              No filings yet. Create one to start the review process.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filings.map((filing) => (
                <button
                  key={filing.id}
                  onClick={() => navigate(`/accountant/filings/${filing.id}`)}
                  className="flex items-start gap-3 px-4 py-3 w-full text-left hover:bg-secondary/50 transition-colors"
                >
                  <FilingStatusIcon status={filing.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {FILING_TYPE_LABELS[filing.filing_type] ?? filing.filing_type}
                      </p>
                      <FilingStatusBadge status={filing.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {filing.tax_period_start} — {filing.tax_period_end}
                      </span>
                      {filing.approved_at && (
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-500" />
                          Approved {new Date(filing.approved_at).toLocaleDateString("en-IE")}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

function FilingStatusIcon({ status }: { status: FilingStatus }) {
  const icons: Record<FilingStatus, React.ReactNode> = {
    draft: <Clock className="w-4 h-4 text-gray-400" />,
    in_review: <FileText className="w-4 h-4 text-blue-500" />,
    approved: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
    filed: <Send className="w-4 h-4 text-purple-500" />,
    acknowledged: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  };
  return <div className="mt-0.5 shrink-0">{icons[status]}</div>;
}

function FilingStatusBadge({ status }: { status: FilingStatus }) {
  const config: Record<FilingStatus, string> = {
    draft: "bg-gray-500/10 text-gray-500",
    in_review: "bg-blue-500/10 text-blue-500",
    approved: "bg-emerald-500/10 text-emerald-500",
    filed: "bg-purple-500/10 text-purple-500",
    acknowledged: "bg-emerald-600/10 text-emerald-600",
  };
  const labels: Record<FilingStatus, string> = {
    draft: "Draft",
    in_review: "In Review",
    approved: "Approved",
    filed: "Filed",
    acknowledged: "Acknowledged",
  };
  return (
    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${config[status]}`}>
      {labels[status]}
    </Badge>
  );
}

const FILING_TYPE_LABELS: Record<string, string> = {
  ct1: "CT1 — Corporation Tax",
  form11: "Form 11 — Income Tax",
  vat3: "VAT3 — VAT Return",
  rct_monthly: "RCT Monthly",
  b1: "B1 — Annual Return",
  annual_return: "Annual Return",
};

export default ClientFilingsTab;
