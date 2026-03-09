import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Shield,
  FileText,
  AlertTriangle,
  Check,
  Calendar,
  Settings,
  Users,
  Bell,
  Link as LinkIcon,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import {
  useRCTContracts,
  useCreateRCTContract,
  useRCTSubcontractors,
  useAddRCTSubcontractor,
  useRCTRateLookup,
  useRCTPaymentNotifications,
  useRCTMonthlyReturn,
  useSubmitRCTReturn,
  useAgentCredentials,
  useSaveAgentCredentials,
  useClientRevenueLink,
  useSaveClientRevenueLink,
  type RCTContract,
  type RCTSubcontractor,
  type RCTPaymentNotification,
  type RCTMonthlyReturn,
  type RCTRevenueSetup,
  type ClientRevenueLink,
} from "@/hooks/accountant/useRCT";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface RCTManagerProps {
  clientUserId: string;
  accountantClientId: string;
  clientName?: string;
}

/* ================================================================== */
/*  1. ContractsPanel                                                  */
/* ================================================================== */

const CONTRACT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-100 text-green-700 border-green-200" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 border-red-200" },
};

type ContractFormState = {
  principal_name: string;
  principal_tax_ref: string;
  contract_ref: string;
  site_address: string;
  start_date: string;
  end_date: string;
  estimated_value: string;
};

const defaultContractForm: ContractFormState = {
  principal_name: "",
  principal_tax_ref: "",
  contract_ref: "",
  site_address: "",
  start_date: "",
  end_date: "",
  estimated_value: "",
};

function ContractsPanel({ clientUserId }: { clientUserId: string }) {
  const { data: contracts, isLoading } = useRCTContracts(clientUserId);
  const createContract = useCreateRCTContract();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ContractFormState>(defaultContractForm);

  const resetForm = () => setForm(defaultContractForm);

  const handleCreate = () => {
    const estimatedValue = parseFloat(form.estimated_value) || 0;
    if (!form.principal_name || !form.contract_ref || !form.start_date) {
      toast.error("Please fill in required fields: principal name, contract ref, and start date.");
      return;
    }
    createContract.mutate(
      {
        user_id: clientUserId,
        principal_name: form.principal_name,
        principal_tax_ref: form.principal_tax_ref || undefined,
        contract_ref: form.contract_ref,
        site_address: form.site_address || undefined,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        estimated_value: estimatedValue > 0 ? estimatedValue : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Contract created and Revenue notified.");
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) => {
          toast.error(`Failed to create contract: ${err.message}`);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading contracts...</span>
      </div>
    );
  }

  const allContracts = contracts ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            RCT Contracts
          </h3>
          <p className="text-xs text-muted-foreground">
            {allContracts.length} contract{allContracts.length !== 1 ? "s" : ""}
            {" "}&middot;{" "}
            {allContracts.filter((c) => c.status === "active").length} active
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          New Contract
        </Button>
      </div>

      {allContracts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No RCT contracts yet. Click &quot;New Contract&quot; to register one with Revenue.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Contract Ref</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Principal</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Tax Ref</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Site Address</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Dates</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Est. Value</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allContracts.map((c) => {
                  const statusCfg = CONTRACT_STATUS_CONFIG[c.status] ?? CONTRACT_STATUS_CONFIG.active;
                  return (
                    <tr key={c.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                      <td className="py-1.5 px-3 font-mono text-xs font-medium">{c.contract_ref}</td>
                      <td className="py-1.5 px-3">{c.principal_name}</td>
                      <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">{c.principal_tax_ref || "\u2014"}</td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate">{c.site_address || "\u2014"}</td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {formatDate(c.start_date)}
                        {c.end_date ? ` \u2013 ${formatDate(c.end_date)}` : " \u2013 ongoing"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                        {c.estimated_value ? eur(c.estimated_value) : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                          {statusCfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* New Contract Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              New RCT Contract
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Principal Name *</Label>
                <Input
                  value={form.principal_name}
                  onChange={(e) => setForm({ ...form, principal_name: e.target.value })}
                  placeholder="ABC Construction Ltd"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Principal Tax Ref</Label>
                <Input
                  value={form.principal_tax_ref}
                  onChange={(e) => setForm({ ...form, principal_tax_ref: e.target.value })}
                  placeholder="1234567T"
                  className="h-8 font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contract Reference *</Label>
              <Input
                value={form.contract_ref}
                onChange={(e) => setForm({ ...form, contract_ref: e.target.value })}
                placeholder="CON-2026-001"
                className="h-8 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Site Address</Label>
              <Input
                value={form.site_address}
                onChange={(e) => setForm({ ...form, site_address: e.target.value })}
                placeholder="123 Main Street, Dublin 2"
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimated Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                  placeholder="50000"
                  className="h-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleCreate}
              disabled={!form.principal_name || !form.contract_ref || !form.start_date || createContract.isPending}
            >
              {createContract.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Notifying Revenue...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Notify Revenue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== */
/*  2. SubcontractorsPanel                                             */
/* ================================================================== */

const RATE_COLOR: Record<number, string> = {
  0: "bg-green-100 text-green-700 border-green-200",
  20: "bg-amber-100 text-amber-700 border-amber-200",
  35: "bg-red-100 text-red-700 border-red-200",
};

function getRateColor(rate: number): string {
  if (rate === 0) return RATE_COLOR[0];
  if (rate <= 20) return RATE_COLOR[20];
  return RATE_COLOR[35];
}

type SubcontractorFormState = {
  name: string;
  tax_ref: string;
  contact_email: string;
  contact_phone: string;
};

const defaultSubForm: SubcontractorFormState = {
  name: "",
  tax_ref: "",
  contact_email: "",
  contact_phone: "",
};

function SubcontractorsPanel({ clientUserId }: { clientUserId: string }) {
  const { data: subcontractors, isLoading } = useRCTSubcontractors(clientUserId);
  const addSubcontractor = useAddRCTSubcontractor();
  const rateLookup = useRCTRateLookup();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SubcontractorFormState>(defaultSubForm);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const resetForm = () => setForm(defaultSubForm);

  const handleAdd = () => {
    if (!form.name || !form.tax_ref) {
      toast.error("Name and tax reference are required.");
      return;
    }
    addSubcontractor.mutate(
      {
        user_id: clientUserId,
        name: form.name,
        tax_ref: form.tax_ref,
        contact_email: form.contact_email || undefined,
        contact_phone: form.contact_phone || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Subcontractor added.");
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) => {
          toast.error(`Failed to add subcontractor: ${err.message}`);
        },
      },
    );
  };

  const handleCheckRate = (sub: RCTSubcontractor) => {
    setCheckingId(sub.id);
    rateLookup.mutate(
      { user_id: clientUserId, subcontractor_id: sub.id, tax_ref: sub.tax_ref },
      {
        onSuccess: (data) => {
          toast.success(`Rate for ${sub.name}: ${data.rate}%`);
          setCheckingId(null);
        },
        onError: (err) => {
          toast.error(`Rate lookup failed: ${err.message}`);
          setCheckingId(null);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading subcontractors...</span>
      </div>
    );
  }

  const allSubs = subcontractors ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Subcontractors
          </h3>
          <p className="text-xs text-muted-foreground">
            {allSubs.length} subcontractor{allSubs.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Add Subcontractor
        </Button>
      </div>

      {allSubs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No subcontractors registered. Add one to start tracking RCT rates.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Name</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Tax Ref</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Current Rate</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Last Verified</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSubs.map((sub) => (
                  <tr key={sub.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                    <td className="py-1.5 px-3 font-medium">{sub.name}</td>
                    <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">{sub.tax_ref}</td>
                    <td className="py-1.5 px-3 text-center">
                      <Badge variant="outline" className={`text-[10px] font-mono ${getRateColor(sub.current_rate)}`}>
                        {sub.current_rate}%
                      </Badge>
                    </td>
                    <td className="py-1.5 px-3 text-xs text-muted-foreground">
                      {sub.last_verified_date ? formatDate(sub.last_verified_date) : "Never"}
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs gap-1"
                        onClick={() => handleCheckRate(sub)}
                        disabled={checkingId === sub.id}
                      >
                        {checkingId === sub.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Check Rate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add Subcontractor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Add Subcontractor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Smith Plumbing Ltd"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Reference *</Label>
                <Input
                  value={form.tax_ref}
                  onChange={(e) => setForm({ ...form, tax_ref: e.target.value })}
                  placeholder="1234567T"
                  className="h-8 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  placeholder="info@smith.ie"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={form.contact_phone}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  placeholder="087 123 4567"
                  className="h-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!form.name || !form.tax_ref || addSubcontractor.isPending}
            >
              {addSubcontractor.isPending ? "Adding..." : "Add Subcontractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== */
/*  3. PaymentNotificationsPanel                                       */
/* ================================================================== */

const PN_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  authorised: { label: "Authorised", color: "bg-green-100 text-green-700 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200" },
  error: { label: "Error", color: "bg-red-100 text-red-700 border-red-200" },
};

function PaymentNotificationsPanel({ clientUserId }: { clientUserId: string }) {
  const { data: contracts } = useRCTContracts(clientUserId);
  const [contractFilter, setContractFilter] = useState<string>("all");
  const { data: notifications, isLoading } = useRCTPaymentNotifications(
    clientUserId,
    contractFilter === "all" ? undefined : contractFilter,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading payment notifications...</span>
      </div>
    );
  }

  const allNotifications = notifications ?? [];
  const allContracts = contracts ?? [];

  const totals = useMemo(() => {
    return allNotifications.reduce(
      (acc, n) => ({
        gross: acc.gross + n.gross_amount,
        deducted: acc.deducted + n.rct_deducted,
        net: acc.net + n.net_amount,
      }),
      { gross: 0, deducted: 0, net: 0 },
    );
  }, [allNotifications]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Payment Notifications
          </h3>
          <p className="text-xs text-muted-foreground">
            {allNotifications.length} deduction authorisation{allNotifications.length !== 1 ? "s" : ""}
            {totals.gross > 0 && <> &middot; Gross: {eur(totals.gross)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Contract:</Label>
          <Select value={contractFilter} onValueChange={setContractFilter}>
            <SelectTrigger className="h-7 w-[180px] text-xs">
              <SelectValue placeholder="All contracts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All contracts</SelectItem>
              {allContracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.contract_ref} &mdash; {c.principal_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {allNotifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No payment notifications found
            {contractFilter !== "all" ? " for this contract" : ""}.
            Notifications appear when payments are submitted to Revenue.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Subcontractor</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Gross</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Rate</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">RCT Deducted</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Net</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Deduction Ref</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allNotifications.map((pn) => {
                  const statusCfg = PN_STATUS_CONFIG[pn.status] ?? PN_STATUS_CONFIG.pending;
                  return (
                    <tr key={pn.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">{formatDate(pn.date)}</td>
                      <td className="py-1.5 px-3 font-medium">{pn.subcontractor_name}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">{eur(pn.gross_amount)}</td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] font-mono ${getRateColor(pn.rate)}`}>
                          {pn.rate}%
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-red-600">
                        {pn.rct_deducted > 0 ? `-${eur(pn.rct_deducted)}` : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium text-emerald-700">
                        {eur(pn.net_amount)}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-xs text-muted-foreground">
                        {pn.deduction_ref || "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                          {pn.status === "error" && <AlertTriangle className="w-2.5 h-2.5 mr-0.5 inline" />}
                          {statusCfg.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                {allNotifications.length > 1 && (
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>TOTALS</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(totals.gross)}</td>
                    <td></td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">-{eur(totals.deducted)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">{eur(totals.net)}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */
/*  4. MonthlyReturnsPanel                                             */
/* ================================================================== */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function MonthlyReturnsPanel({ clientUserId }: { clientUserId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const numMonth = parseInt(month, 10);
  const numYear = parseInt(year, 10);

  const { data: returnData, isLoading } = useRCTMonthlyReturn(clientUserId, numYear, numMonth);
  const submitReturn = useSubmitRCTReturn();

  const handleSubmit = () => {
    submitReturn.mutate(
      { user_id: clientUserId, year: numYear, month: numMonth },
      {
        onSuccess: () => {
          toast.success(`RCT return for ${MONTHS[numMonth - 1]} ${numYear} submitted successfully.`);
        },
        onError: (err) => {
          toast.error(`Failed to submit return: ${err.message}`);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Monthly Returns
          </h3>
          <p className="text-xs text-muted-foreground">
            RCT return summary by period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-7 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[numYear - 1, numYear, numYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading return data...</span>
        </div>
      ) : !returnData || returnData.breakdown.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No RCT activity for {MONTHS[numMonth - 1]} {numYear}.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Gross</p>
                <p className="text-lg font-semibold font-mono tabular-nums">{eur(returnData.total_gross)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">RCT Deducted</p>
                <p className="text-lg font-semibold font-mono tabular-nums text-red-600">{eur(returnData.total_rct_deducted)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Net Paid</p>
                <p className="text-lg font-semibold font-mono tabular-nums text-emerald-700">{eur(returnData.total_net)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown by subcontractor */}
          <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Breakdown by Subcontractor</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Subcontractor</th>
                    <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Rate</th>
                    <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Gross</th>
                    <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">RCT Deducted</th>
                    <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {returnData.breakdown.map((row, i) => (
                    <tr key={i} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                      <td className="py-1.5 px-3 font-medium">{row.subcontractor_name}</td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] font-mono ${getRateColor(row.rate)}`}>
                          {row.rate}%
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">{eur(row.gross)}</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-red-600">
                        {row.rct_deducted > 0 ? `-${eur(row.rct_deducted)}` : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-emerald-700">{eur(row.net)}</td>
                    </tr>
                  ))}
                  {returnData.breakdown.length > 1 && (
                    <tr className="border-t-2 font-semibold">
                      <td className="py-2 px-3" colSpan={2}>TOTALS</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(returnData.total_gross)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">-{eur(returnData.total_rct_deducted)}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">{eur(returnData.total_net)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Submit button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSubmit}
              disabled={submitReturn.isPending || returnData.status === "submitted"}
            >
              {submitReturn.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : returnData.status === "submitted" ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Submitted
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Return
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  5. RevenueSetupPanel                                               */
/* ================================================================== */

type AgentFormState = {
  tain: string;
  agent_name: string;
  tax_registration_number: string;
  ros_cert_serial: string;
  test_mode: boolean;
};

const defaultAgentForm: AgentFormState = {
  tain: "",
  agent_name: "",
  tax_registration_number: "",
  ros_cert_serial: "",
  test_mode: true,
};

type ClientLinkFormState = {
  employer_reg_number: string;
  tax_reg_number: string;
  rct_principal_number: string;
};

const defaultClientLinkForm: ClientLinkFormState = {
  employer_reg_number: "",
  tax_reg_number: "",
  rct_principal_number: "",
};

function RevenueSetupPanel({ clientUserId, accountantClientId }: { clientUserId: string; accountantClientId: string }) {
  // Agent credentials (one set per accountant, shared across all clients)
  const { data: agentCreds, isLoading: agentLoading } = useAgentCredentials();
  const saveAgentCreds = useSaveAgentCredentials();
  const [agentForm, setAgentForm] = useState<AgentFormState>(defaultAgentForm);
  const [agentInitialised, setAgentInitialised] = useState(false);

  // Client Revenue link (per-client)
  const { data: clientLink, isLoading: clientLoading } = useClientRevenueLink(accountantClientId);
  const saveClientLink = useSaveClientRevenueLink();
  const [clientForm, setClientForm] = useState<ClientLinkFormState>(defaultClientLinkForm);
  const [clientInitialised, setClientInitialised] = useState(false);

  // Populate agent form when data loads
  if (agentCreds && !agentInitialised) {
    setAgentForm({
      tain: agentCreds.tain || "",
      agent_name: agentCreds.agent_name || "",
      tax_registration_number: agentCreds.tax_registration_number || "",
      ros_cert_serial: agentCreds.ros_cert_serial || "",
      test_mode: agentCreds.test_mode ?? true,
    });
    setAgentInitialised(true);
  }

  // Populate client form when data loads
  if (clientLink && !clientInitialised) {
    setClientForm({
      employer_reg_number: clientLink.employer_reg_number || "",
      tax_reg_number: clientLink.tax_reg_number || "",
      rct_principal_number: clientLink.rct_principal_number || "",
    });
    setClientInitialised(true);
  }

  const handleSaveAgent = () => {
    if (!agentForm.tain) {
      toast.error("TAIN is required.");
      return;
    }
    if (!agentForm.agent_name) {
      toast.error("Agent / Practice name is required.");
      return;
    }
    if (!agentForm.tax_registration_number) {
      toast.error("Tax Registration Number is required.");
      return;
    }
    saveAgentCreds.mutate({
      tain: agentForm.tain,
      agent_name: agentForm.agent_name,
      tax_registration_number: agentForm.tax_registration_number,
      ros_cert_serial: agentForm.ros_cert_serial || undefined,
      test_mode: agentForm.test_mode,
    });
  };

  const handleSaveClientLink = () => {
    saveClientLink.mutate({
      accountantClientId,
      employer_reg_number: clientForm.employer_reg_number || undefined,
      tax_reg_number: clientForm.tax_reg_number || undefined,
      rct_principal_number: clientForm.rct_principal_number || undefined,
    });
  };

  if (agentLoading || clientLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading setup...</span>
      </div>
    );
  }

  const hasAgentCredentials = !!agentCreds?.tain;
  const hasClientLink = !!clientLink?.revenue_linked;

  return (
    <div className="space-y-6">
      {/* ---- Agent Credentials Section ---- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Agent Credentials
            </h3>
            <p className="text-xs text-muted-foreground">
              Your TAIN and ROS credentials -- shared across all clients
            </p>
          </div>
          {hasAgentCredentials && (
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200 gap-1">
              <Check className="w-2.5 h-2.5" />
              Agent Configured
            </Badge>
          )}
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">TAIN (Tax Agent ID Number) *</Label>
                <Input
                  value={agentForm.tain}
                  onChange={(e) => setAgentForm({ ...agentForm, tain: e.target.value })}
                  placeholder="12345A"
                  className="h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Agent / Practice Name *</Label>
                <Input
                  value={agentForm.agent_name}
                  onChange={(e) => setAgentForm({ ...agentForm, agent_name: e.target.value })}
                  placeholder="Smith & Co Accountants"
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Agent Tax Registration Number *</Label>
                <Input
                  value={agentForm.tax_registration_number}
                  onChange={(e) => setAgentForm({ ...agentForm, tax_registration_number: e.target.value })}
                  placeholder="1234567T"
                  className="h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ROS Digital Certificate Serial</Label>
                <Input
                  value={agentForm.ros_cert_serial}
                  onChange={(e) => setAgentForm({ ...agentForm, ros_cert_serial: e.target.value })}
                  placeholder="Certificate serial number"
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Environment</Label>
                <p className="text-xs text-muted-foreground">
                  {agentForm.test_mode
                    ? "PIT (Pre-production) \u2014 submissions go to Revenue test environment"
                    : "Production \u2014 submissions are live with Revenue"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${agentForm.test_mode ? "text-amber-600" : "text-muted-foreground"}`}>
                  Test
                </span>
                <Switch
                  checked={!agentForm.test_mode}
                  onCheckedChange={(checked) => setAgentForm({ ...agentForm, test_mode: !checked })}
                />
                <span className={`text-xs font-medium ${!agentForm.test_mode ? "text-green-600" : "text-muted-foreground"}`}>
                  Production
                </span>
              </div>
            </div>

            {!agentForm.test_mode && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  Production mode will submit real returns to Revenue. Ensure all credentials are correct and that you have the required ROS digital certificate installed.
                </p>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
              <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-800">
                Your TAIN and ROS certificate authenticate you as a tax agent with Revenue.
                These credentials are used for all client submissions (RCT, PAYE, etc.).
                Only the certificate serial is stored here for reference.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSaveAgent}
                disabled={!agentForm.tain || !agentForm.agent_name || !agentForm.tax_registration_number || saveAgentCreds.isPending}
              >
                {saveAgentCreds.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Agent Credentials
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Client Revenue Link Section ---- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Client Revenue Link
            </h3>
            <p className="text-xs text-muted-foreground">
              Per-client Revenue registration numbers for this client
            </p>
          </div>
          {hasClientLink && (
            <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200 gap-1">
              <Check className="w-2.5 h-2.5" />
              Linked
            </Badge>
          )}
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Employer Registration Number</Label>
                <Input
                  value={clientForm.employer_reg_number}
                  onChange={(e) => setClientForm({ ...clientForm, employer_reg_number: e.target.value })}
                  placeholder="1234567TH"
                  className="h-8 font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tax Registration Number</Label>
                <Input
                  value={clientForm.tax_reg_number}
                  onChange={(e) => setClientForm({ ...clientForm, tax_reg_number: e.target.value })}
                  placeholder="1234567T"
                  className="h-8 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">RCT Principal Number</Label>
              <Input
                value={clientForm.rct_principal_number}
                onChange={(e) => setClientForm({ ...clientForm, rct_principal_number: e.target.value })}
                placeholder="RCT principal registration number"
                className="h-8 font-mono"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSaveClientLink}
                disabled={saveClientLink.isPending}
              >
                {saveClientLink.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Save Client Link
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main RCTManager component                                          */
/* ================================================================== */

export function RCTManager({ clientUserId, accountantClientId, clientName }: RCTManagerProps) {
  const [activeSection, setActiveSection] = useState("contracts");

  return (
    <div className="space-y-4">
      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList>
          <TabsTrigger value="contracts" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="subcontractors" className="gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Subcontractors
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs">
            <Send className="w-3.5 h-3.5" />
            Payment Notifications
          </TabsTrigger>
          <TabsTrigger value="returns" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" />
            Monthly Returns
          </TabsTrigger>
          <TabsTrigger value="setup" className="gap-1.5 text-xs">
            <Shield className="w-3.5 h-3.5" />
            Revenue Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contracts">
          <ContractsPanel clientUserId={clientUserId} />
        </TabsContent>

        <TabsContent value="subcontractors">
          <SubcontractorsPanel clientUserId={clientUserId} />
        </TabsContent>

        <TabsContent value="notifications">
          <PaymentNotificationsPanel clientUserId={clientUserId} />
        </TabsContent>

        <TabsContent value="returns">
          <MonthlyReturnsPanel clientUserId={clientUserId} />
        </TabsContent>

        <TabsContent value="setup">
          <RevenueSetupPanel clientUserId={clientUserId} accountantClientId={accountantClientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
