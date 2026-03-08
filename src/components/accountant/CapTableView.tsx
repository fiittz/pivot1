import { useState, useMemo } from "react";
import {
  Plus,
  Loader2,
  ArrowRightLeft,
  Users,
  AlertTriangle,
  PieChart,
  Shield,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCapTable,
  useCreateShareClass,
  useCreateShareholder,
  useAllocateShares,
  useTransferShares,
  useUpdateShareholder,
  type Shareholder,
  type ShareAllocation,
  type ShareholderType,
} from "@/hooks/accountant/useCapTable";

interface CapTableViewProps {
  clientUserId: string;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const TYPE_BADGES: Record<ShareholderType, { label: string; color: string }> = {
  individual: { label: "Individual", color: "bg-blue-100 text-blue-700 border-blue-200" },
  company: { label: "Company", color: "bg-purple-100 text-purple-700 border-purple-200" },
  trust: { label: "Trust", color: "bg-gray-100 text-gray-700 border-gray-200" },
  nominee: { label: "Nominee", color: "bg-orange-100 text-orange-700 border-orange-200" },
};

const ACQUISITION_TYPES = [
  { value: "incorporation", label: "Incorporation" },
  { value: "allotment", label: "Allotment" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "bonus_issue", label: "Bonus Issue" },
];

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

export function CapTableView({ clientUserId }: CapTableViewProps) {
  const { data, isLoading } = useCapTable(clientUserId);
  const createShareClass = useCreateShareClass();
  const createShareholder = useCreateShareholder();
  const allocateShares = useAllocateShares();
  const transferShares = useTransferShares();
  const updateShareholder = useUpdateShareholder();

  // Dialog states
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [shareholderDialogOpen, setShareholderDialogOpen] = useState(false);
  const [allocateDialogOpen, setAllocateDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Pre-selected shareholder for allocate/transfer
  const [selectedShareholder, setSelectedShareholder] = useState<Shareholder | null>(null);
  const [selectedAllocation, setSelectedAllocation] = useState<ShareAllocation | null>(null);

  // Share class form
  const [classForm, setClassForm] = useState({
    class_name: "Ordinary",
    nominal_value: "1.00",
    voting_rights: true,
    dividend_rights: true,
    currency: "EUR",
    total_authorised: "",
    notes: "",
  });

  // Shareholder form
  const [holderForm, setHolderForm] = useState({
    shareholder_name: "",
    shareholder_type: "individual" as ShareholderType,
    ppsn: "",
    company_number: "",
    address: "",
    email: "",
    phone: "",
    is_director: false,
    notes: "",
  });

  // Allocate shares form
  const [allocForm, setAllocForm] = useState({
    shareholder_id: "",
    share_class_id: "",
    num_shares: "",
    date_acquired: "",
    acquisition_type: "incorporation",
    price_per_share: "1.00",
    certificate_number: "",
    notes: "",
  });

  // Transfer shares form
  const [transferForm, setTransferForm] = useState({
    to_shareholder_id: "",
    num_shares: "",
    transfer_date: "",
    price_per_share: "1.00",
  });

  // Summary computations
  const summary = useMemo(() => {
    if (!data) return { totalShares: 0, numShareholders: 0, shareCapital: 0 };
    const shareCapital = data.shareClasses.reduce((sum, sc) => {
      const classShares = data.shareholders.reduce((s, sh) => {
        return s + sh.allocations
          .filter((a) => a.share_class_id === sc.id)
          .reduce((acc, a) => acc + a.num_shares, 0);
      }, 0);
      return sum + classShares * sc.nominal_value;
    }, 0);
    return {
      totalShares: data.totalSharesIssued,
      numShareholders: data.shareholders.filter((s) => s.is_active).length,
      shareCapital,
    };
  }, [data]);

  const resetClassForm = () => setClassForm({
    class_name: "Ordinary",
    nominal_value: "1.00",
    voting_rights: true,
    dividend_rights: true,
    currency: "EUR",
    total_authorised: "",
    notes: "",
  });

  const resetHolderForm = () => setHolderForm({
    shareholder_name: "",
    shareholder_type: "individual",
    ppsn: "",
    company_number: "",
    address: "",
    email: "",
    phone: "",
    is_director: false,
    notes: "",
  });

  const resetAllocForm = () => setAllocForm({
    shareholder_id: "",
    share_class_id: "",
    num_shares: "",
    date_acquired: "",
    acquisition_type: "incorporation",
    price_per_share: "1.00",
    certificate_number: "",
    notes: "",
  });

  const resetTransferForm = () => setTransferForm({
    to_shareholder_id: "",
    num_shares: "",
    transfer_date: "",
    price_per_share: "1.00",
  });

  // Handlers
  const handleCreateClass = () => {
    createShareClass.mutate(
      {
        user_id: clientUserId,
        class_name: classForm.class_name,
        nominal_value: parseFloat(classForm.nominal_value) || 1,
        voting_rights: classForm.voting_rights,
        dividend_rights: classForm.dividend_rights,
        currency: classForm.currency,
        total_authorised: classForm.total_authorised ? parseInt(classForm.total_authorised) : null,
        notes: classForm.notes || undefined,
      },
      { onSuccess: () => { setClassDialogOpen(false); resetClassForm(); } },
    );
  };

  const handleCreateShareholder = () => {
    createShareholder.mutate(
      {
        user_id: clientUserId,
        shareholder_name: holderForm.shareholder_name,
        shareholder_type: holderForm.shareholder_type,
        ppsn: holderForm.ppsn || undefined,
        company_number: holderForm.company_number || undefined,
        address: holderForm.address || undefined,
        email: holderForm.email || undefined,
        phone: holderForm.phone || undefined,
        is_director: holderForm.is_director,
        notes: holderForm.notes || undefined,
      },
      { onSuccess: () => { setShareholderDialogOpen(false); resetHolderForm(); } },
    );
  };

  const handleAllocate = () => {
    const numShares = parseInt(allocForm.num_shares);
    const pricePerShare = parseFloat(allocForm.price_per_share) || 0;
    allocateShares.mutate(
      {
        user_id: clientUserId,
        shareholder_id: allocForm.shareholder_id,
        share_class_id: allocForm.share_class_id,
        num_shares: numShares,
        date_acquired: allocForm.date_acquired,
        acquisition_type: allocForm.acquisition_type,
        price_per_share: pricePerShare,
        total_consideration: numShares * pricePerShare,
        certificate_number: allocForm.certificate_number || undefined,
        notes: allocForm.notes || undefined,
      },
      { onSuccess: () => { setAllocateDialogOpen(false); resetAllocForm(); } },
    );
  };

  const handleTransfer = () => {
    if (!selectedAllocation || !selectedShareholder) return;
    transferShares.mutate(
      {
        user_id: clientUserId,
        from_allocation_id: selectedAllocation.id,
        to_shareholder_id: transferForm.to_shareholder_id,
        share_class_id: selectedAllocation.share_class_id,
        num_shares: parseInt(transferForm.num_shares) || selectedAllocation.num_shares,
        transfer_date: transferForm.transfer_date,
        price_per_share: parseFloat(transferForm.price_per_share) || 0,
      },
      {
        onSuccess: () => {
          setTransferDialogOpen(false);
          resetTransferForm();
          setSelectedShareholder(null);
          setSelectedAllocation(null);
        },
      },
    );
  };

  const openAllocate = (shareholder?: Shareholder) => {
    resetAllocForm();
    if (shareholder) {
      setAllocForm((f) => ({ ...f, shareholder_id: shareholder.id }));
    }
    setAllocateDialogOpen(true);
  };

  const openTransfer = (shareholder: Shareholder, allocation: ShareAllocation) => {
    setSelectedShareholder(shareholder);
    setSelectedAllocation(allocation);
    resetTransferForm();
    setTransferForm((f) => ({
      ...f,
      num_shares: String(allocation.num_shares),
      price_per_share: String(allocation.price_per_share),
    }));
    setTransferDialogOpen(true);
  };

  // Issued shares per class
  const issuedByClass = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const sh of data.shareholders) {
      for (const a of sh.allocations) {
        map.set(a.share_class_id, (map.get(a.share_class_id) ?? 0) + a.num_shares);
      }
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading cap table...</span>
      </div>
    );
  }

  const shareClasses = data?.shareClasses ?? [];
  const shareholders = data?.shareholders ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Cap Table</h3>
          <p className="text-xs text-muted-foreground">
            Capitalisation table &middot; {shareholders.filter((s) => s.is_active).length} shareholder{shareholders.filter((s) => s.is_active).length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { resetHolderForm(); setShareholderDialogOpen(true); }}>
            <Users className="w-3.5 h-3.5" />
            Add Shareholder
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => openAllocate()}>
            <Plus className="w-3.5 h-3.5" />
            Allocate Shares
          </Button>
        </div>
      </div>

      {/* Close Company Warning */}
      {data?.isCloseCompany && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm rounded-2xl">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">Close Company.</span>{" "}
              This company has 5 or fewer participators controlling &gt;50% of shares.
              A surcharge of 20% applies to undistributed investment/estate income,
              and 15% to undistributed trading income under Section 440 TCA 1997.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Shares Issued</p>
            <p className="text-xl font-semibold tabular-nums">{summary.totalShares.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Shareholders</p>
            <p className="text-xl font-semibold tabular-nums">{summary.numShareholders}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Share Capital</p>
            <p className="text-xl font-semibold tabular-nums">{eur(summary.shareCapital)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Close Company</p>
            <div className="mt-1">
              {data?.isCloseCompany ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">Yes</Badge>
              ) : (
                <Badge className="bg-green-100 text-green-700 border-green-200">No</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share Classes */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Share Classes
            </h4>
            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => { resetClassForm(); setClassDialogOpen(true); }}>
              <Plus className="w-3 h-3" />
              Add Class
            </Button>
          </div>
          {shareClasses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No share classes defined. Add an &quot;Ordinary&quot; class to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Class Name</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Nominal Value</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Voting</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Dividend Rights</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Authorised</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Issued</th>
                </tr>
              </thead>
              <tbody>
                {shareClasses.map((sc) => (
                  <tr key={sc.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                    <td className="py-1.5 px-3 font-medium">{sc.class_name}</td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums">{eur(sc.nominal_value)}</td>
                    <td className="py-1.5 px-3 text-center">
                      {sc.voting_rights ? <Check className="w-3.5 h-3.5 text-green-600 mx-auto" /> : <X className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {sc.dividend_rights ? <Check className="w-3.5 h-3.5 text-green-600 mx-auto" /> : <X className="w-3.5 h-3.5 text-muted-foreground mx-auto" />}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {sc.total_authorised?.toLocaleString() ?? "\u2014"}
                    </td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium">
                      {(issuedByClass.get(sc.id) ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Shareholders Table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5" />
              Shareholders
            </h4>
          </div>
          {shareholders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No shareholders recorded. Click &quot;Add Shareholder&quot; to begin.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Shareholder</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Type</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Director</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Shares</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground w-40">% Ownership</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Share Capital</th>
                  <th className="py-2 px-3 font-medium text-xs text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shareholders
                  .filter((s) => s.is_active)
                  .sort((a, b) => b.totalShares - a.totalShares)
                  .map((sh) => {
                    const typeBadge = TYPE_BADGES[sh.shareholder_type];
                    // Calculate share capital for this shareholder
                    const holderCapital = sh.allocations.reduce((sum, a) => {
                      const sc = shareClasses.find((c) => c.id === a.share_class_id);
                      return sum + a.num_shares * (sc?.nominal_value ?? 1);
                    }, 0);

                    return (
                      <tr key={sh.id} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                        <td className="py-1.5 px-3">
                          <span className="font-medium">{sh.shareholder_name}</span>
                          {sh.email && (
                            <span className="block text-[10px] text-muted-foreground">{sh.email}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3">
                          <Badge variant="outline" className={`text-[10px] ${typeBadge.color}`}>
                            {typeBadge.label}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {sh.is_director ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Director</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">\u2014</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium">
                          {sh.totalShares.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${Math.min(sh.ownershipPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums font-mono w-12 text-right">
                              {sh.ownershipPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {eur(holderCapital)}
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs gap-1"
                              onClick={() => openAllocate(sh)}
                            >
                              <Plus className="w-3 h-3" />
                              Allocate
                            </Button>
                            {sh.allocations.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs gap-1"
                                onClick={() => openTransfer(sh, sh.allocations[0])}
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Transfer
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {/* Totals row */}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3" colSpan={3}>TOTALS</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {summary.totalShares.toLocaleString()}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-blue-500 rounded-full" />
                      <span className="text-xs tabular-nums font-mono w-12 text-right">100%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(summary.shareCapital)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ──────────────── DIALOGS ──────────────── */}

      {/* Add Share Class Dialog */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Add Share Class
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Class Name</Label>
              <Input
                value={classForm.class_name}
                onChange={(e) => setClassForm({ ...classForm, class_name: e.target.value })}
                placeholder="e.g. Ordinary, Preference A"
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nominal Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={classForm.nominal_value}
                  onChange={(e) => setClassForm({ ...classForm, nominal_value: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Total Authorised (optional)</Label>
                <Input
                  type="number"
                  value={classForm.total_authorised}
                  onChange={(e) => setClassForm({ ...classForm, total_authorised: e.target.value })}
                  placeholder="e.g. 1000"
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={classForm.voting_rights}
                  onCheckedChange={(v) => setClassForm({ ...classForm, voting_rights: !!v })}
                />
                <span className="text-xs">Voting Rights</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={classForm.dividend_rights}
                  onCheckedChange={(v) => setClassForm({ ...classForm, dividend_rights: !!v })}
                />
                <span className="text-xs">Dividend Rights</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea
                value={classForm.notes}
                onChange={(e) => setClassForm({ ...classForm, notes: e.target.value })}
                placeholder="Any special rights or restrictions..."
                className="w-full h-16 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setClassDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleCreateClass}
              disabled={!classForm.class_name || createShareClass.isPending}
            >
              {createShareClass.isPending ? "Creating..." : "Create Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Shareholder Dialog */}
      <Dialog open={shareholderDialogOpen} onOpenChange={setShareholderDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Add Shareholder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={holderForm.shareholder_name}
                  onChange={(e) => setHolderForm({ ...holderForm, shareholder_name: e.target.value })}
                  placeholder="John Smith"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select
                  value={holderForm.shareholder_type}
                  onValueChange={(v) => setHolderForm({ ...holderForm, shareholder_type: v as ShareholderType })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="trust">Trust</SelectItem>
                    <SelectItem value="nominee">Nominee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {holderForm.shareholder_type === "individual" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">PPSN</Label>
                  <Input
                    value={holderForm.ppsn}
                    onChange={(e) => setHolderForm({ ...holderForm, ppsn: e.target.value })}
                    placeholder="1234567AB"
                    className="h-8"
                  />
                </div>
              )}
              {holderForm.shareholder_type === "company" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Number</Label>
                  <Input
                    value={holderForm.company_number}
                    onChange={(e) => setHolderForm({ ...holderForm, company_number: e.target.value })}
                    placeholder="123456"
                    className="h-8"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={holderForm.email}
                  onChange={(e) => setHolderForm({ ...holderForm, email: e.target.value })}
                  placeholder="john@example.com"
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={holderForm.phone}
                  onChange={(e) => setHolderForm({ ...holderForm, phone: e.target.value })}
                  placeholder="+353 ..."
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input
                  value={holderForm.address}
                  onChange={(e) => setHolderForm({ ...holderForm, address: e.target.value })}
                  placeholder="123 Main St, Dublin"
                  className="h-8"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={holderForm.is_director}
                onCheckedChange={(v) => setHolderForm({ ...holderForm, is_director: !!v })}
              />
              <span className="text-xs">Is a Director</span>
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea
                value={holderForm.notes}
                onChange={(e) => setHolderForm({ ...holderForm, notes: e.target.value })}
                placeholder="Any additional details..."
                className="w-full h-16 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShareholderDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleCreateShareholder}
              disabled={!holderForm.shareholder_name || createShareholder.isPending}
            >
              {createShareholder.isPending ? "Adding..." : "Add Shareholder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Shares Dialog */}
      <Dialog open={allocateDialogOpen} onOpenChange={setAllocateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Allocate Shares
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Shareholder</Label>
              <Select
                value={allocForm.shareholder_id}
                onValueChange={(v) => setAllocForm({ ...allocForm, shareholder_id: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select shareholder" />
                </SelectTrigger>
                <SelectContent>
                  {shareholders.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.shareholder_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Share Class</Label>
              <Select
                value={allocForm.share_class_id}
                onValueChange={(v) => setAllocForm({ ...allocForm, share_class_id: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select share class" />
                </SelectTrigger>
                <SelectContent>
                  {shareClasses.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.class_name} ({eur(sc.nominal_value)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Number of Shares</Label>
                <Input
                  type="number"
                  value={allocForm.num_shares}
                  onChange={(e) => setAllocForm({ ...allocForm, num_shares: e.target.value })}
                  placeholder="100"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date Acquired</Label>
                <Input
                  type="date"
                  value={allocForm.date_acquired}
                  onChange={(e) => setAllocForm({ ...allocForm, date_acquired: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Acquisition Type</Label>
                <Select
                  value={allocForm.acquisition_type}
                  onValueChange={(v) => setAllocForm({ ...allocForm, acquisition_type: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACQUISITION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Price per Share</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={allocForm.price_per_share}
                  onChange={(e) => setAllocForm({ ...allocForm, price_per_share: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Consideration:</span>
              <span className="font-mono font-medium">
                {eur((parseInt(allocForm.num_shares) || 0) * (parseFloat(allocForm.price_per_share) || 0))}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Certificate Number (optional)</Label>
              <Input
                value={allocForm.certificate_number}
                onChange={(e) => setAllocForm({ ...allocForm, certificate_number: e.target.value })}
                placeholder="CERT-001"
                className="h-8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAllocateDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleAllocate}
              disabled={
                !allocForm.shareholder_id ||
                !allocForm.share_class_id ||
                !allocForm.num_shares ||
                !allocForm.date_acquired ||
                allocateShares.isPending
              }
            >
              {allocateShares.isPending ? "Allocating..." : "Allocate Shares"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Shares Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Transfer Shares
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{selectedShareholder?.shareholder_name}</span>
            </div>
            {selectedAllocation && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Allocation:</span>
                <span className="font-mono text-xs">
                  {selectedAllocation.num_shares.toLocaleString()} {selectedAllocation.share_class_name} shares
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">To Shareholder</Label>
              <Select
                value={transferForm.to_shareholder_id}
                onValueChange={(v) => setTransferForm({ ...transferForm, to_shareholder_id: v })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select recipient" />
                </SelectTrigger>
                <SelectContent>
                  {shareholders
                    .filter((s) => s.is_active && s.id !== selectedShareholder?.id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.shareholder_name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Number of Shares</Label>
                <Input
                  type="number"
                  value={transferForm.num_shares}
                  onChange={(e) => setTransferForm({ ...transferForm, num_shares: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Transfer Date</Label>
                <Input
                  type="date"
                  value={transferForm.transfer_date}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price per Share</Label>
              <Input
                type="number"
                step="0.01"
                value={transferForm.price_per_share}
                onChange={(e) => setTransferForm({ ...transferForm, price_per_share: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Consideration:</span>
              <span className="font-mono font-medium">
                {eur((parseInt(transferForm.num_shares) || 0) * (parseFloat(transferForm.price_per_share) || 0))}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleTransfer}
              disabled={
                !transferForm.to_shareholder_id ||
                !transferForm.num_shares ||
                !transferForm.transfer_date ||
                transferShares.isPending
              }
            >
              {transferShares.isPending ? "Transferring..." : "Transfer Shares"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
