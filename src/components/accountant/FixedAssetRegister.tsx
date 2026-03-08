import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Building,
  Wrench,
  Lamp,
  Car,
  Monitor,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useFixedAssets,
  useCreateFixedAsset,
  useDisposeFixedAsset,
  calculateDepreciation,
  calculateCapitalAllowance,
  type FixedAsset,
  type AssetCategory,
  type DepreciationMethod,
} from "@/hooks/accountant/useFixedAssets";

interface FixedAssetRegisterProps {
  clientUserId: string;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

const CATEGORY_CONFIG: Record<
  AssetCategory,
  { label: string; color: string; icon: typeof Building }
> = {
  land_and_buildings: { label: "Land & Buildings", color: "bg-slate-100 text-slate-700 border-slate-200", icon: Building },
  plant_and_machinery: { label: "Plant & Machinery", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Wrench },
  fixtures_and_fittings: { label: "Fixtures & Fittings", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: Lamp },
  motor_vehicles: { label: "Motor Vehicles", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Car },
  computer_equipment: { label: "Computer Equipment", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Monitor },
  office_equipment: { label: "Office Equipment", color: "bg-pink-100 text-pink-700 border-pink-200", icon: Printer },
};

const METHOD_LABELS: Record<DepreciationMethod, string> = {
  straight_line: "Straight Line",
  reducing_balance: "Reducing Balance",
};

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

export function FixedAssetRegister({ clientUserId }: FixedAssetRegisterProps) {
  const { data: assets, isLoading } = useFixedAssets(clientUserId);
  const createAsset = useCreateFixedAsset();
  const disposeAsset = useDisposeFixedAsset();

  const taxYear = new Date().getFullYear() - 1;

  // Add asset dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    asset_name: "",
    asset_category: "computer_equipment" as AssetCategory,
    purchase_date: "",
    purchase_cost: "",
    residual_value: "0",
    useful_life_years: "5",
    depreciation_method: "straight_line" as DepreciationMethod,
    depreciation_rate: "25",
    notes: "",
  });

  // Dispose dialog state
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeTarget, setDisposeTarget] = useState<FixedAsset | null>(null);
  const [disposeDate, setDisposeDate] = useState("");
  const [disposeProceeds, setDisposeProceeds] = useState("");

  const resetForm = () => {
    setForm({
      asset_name: "",
      asset_category: "computer_equipment",
      purchase_date: "",
      purchase_cost: "",
      residual_value: "0",
      useful_life_years: "5",
      depreciation_method: "straight_line",
      depreciation_rate: "25",
      notes: "",
    });
  };

  const handleAdd = () => {
    createAsset.mutate(
      {
        user_id: clientUserId,
        asset_name: form.asset_name,
        asset_category: form.asset_category,
        purchase_date: form.purchase_date,
        purchase_cost: parseFloat(form.purchase_cost),
        residual_value: parseFloat(form.residual_value) || 0,
        useful_life_years: parseInt(form.useful_life_years) || 5,
        depreciation_method: form.depreciation_method,
        depreciation_rate: form.depreciation_method === "reducing_balance" ? parseFloat(form.depreciation_rate) : undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => {
          setAddOpen(false);
          resetForm();
        },
      },
    );
  };

  const openDispose = (asset: FixedAsset) => {
    setDisposeTarget(asset);
    setDisposeDate("");
    setDisposeProceeds("");
    setDisposeOpen(true);
  };

  const handleDispose = () => {
    if (!disposeTarget) return;
    disposeAsset.mutate(
      {
        id: disposeTarget.id,
        user_id: clientUserId,
        disposal_date: disposeDate,
        disposal_proceeds: parseFloat(disposeProceeds) || 0,
      },
      {
        onSuccess: () => setDisposeOpen(false),
      },
    );
  };

  // Compute depreciation for each asset
  const assetRows = useMemo(() => {
    return (assets ?? []).map((asset) => ({
      asset,
      dep: calculateDepreciation(asset, taxYear),
      ca: calculateCapitalAllowance(asset, taxYear),
    }));
  }, [assets, taxYear]);

  // Summaries
  const totals = useMemo(() => {
    let totalCost = 0;
    let totalAccumDep = 0;
    let totalNBV = 0;
    for (const row of assetRows) {
      totalCost += Number(row.asset.purchase_cost);
      totalAccumDep += row.dep.accumulatedDepreciation;
      totalNBV += row.dep.netBookValue;
    }
    return { totalCost, totalAccumDep, totalNBV };
  }, [assetRows]);

  // Capital allowances summary by category
  const caSummary = useMemo(() => {
    const map = new Map<AssetCategory, { totalCost: number; annualAllowance: number; ratePercent: number; periodYears: number }>();
    for (const row of assetRows) {
      if (row.asset.disposal_date) continue; // skip disposed
      const cat = row.asset.asset_category;
      const existing = map.get(cat);
      const isBuilding = cat === "land_and_buildings";
      if (existing) {
        existing.totalCost += Number(row.asset.purchase_cost);
        existing.annualAllowance += row.ca.annualAllowance;
      } else {
        map.set(cat, {
          totalCost: Number(row.asset.purchase_cost),
          annualAllowance: row.ca.annualAllowance,
          ratePercent: isBuilding ? 4 : 12.5,
          periodYears: isBuilding ? 25 : 8,
        });
      }
    }
    return Array.from(map.entries()).map(([category, data]) => ({ category, ...data }));
  }, [assetRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading fixed assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Fixed Asset Register</h3>
          <p className="text-xs text-muted-foreground">
            Year ended 31 Dec {taxYear} &middot; {assetRows.length} asset{assetRows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="w-3.5 h-3.5" />
          Add Asset
        </Button>
      </div>

      {/* Asset table */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {assetRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No fixed assets recorded. Click "Add Asset" to begin.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Asset Name</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Category</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Purchase Date</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Cost</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Dep Method</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Annual Dep</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Accum Dep</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">NBV</th>
                  <th className="py-2 px-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {assetRows.map(({ asset, dep }) => {
                  const isDisposed = !!asset.disposal_date;
                  const catCfg = CATEGORY_CONFIG[asset.asset_category];

                  return (
                    <tr
                      key={asset.id}
                      className={`border-b border-muted/20 hover:bg-muted/10 transition-colors ${
                        isDisposed ? "opacity-60" : ""
                      }`}
                    >
                      <td className="py-1.5 px-3">
                        <div className={isDisposed ? "line-through" : ""}>
                          <span className="text-sm">{asset.asset_name}</span>
                        </div>
                        {isDisposed && (
                          <span className="text-[10px] text-muted-foreground">
                            Disposed {formatDate(asset.disposal_date!)} &middot; Proceeds {eur(Number(asset.disposal_proceeds ?? 0))}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className={`text-[10px] ${catCfg.color}`}>
                          {catCfg.label}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {formatDate(asset.purchase_date)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                        {eur(Number(asset.purchase_cost))}
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {METHOD_LABELS[asset.depreciation_method]}
                        {asset.depreciation_method === "reducing_balance" && asset.depreciation_rate && (
                          <span className="ml-1">({asset.depreciation_rate}%)</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                        {eur(dep.annualDepreciation)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm">
                        {eur(dep.accumulatedDepreciation)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-sm font-medium">
                        {eur(dep.netBookValue)}
                      </td>
                      <td className="py-1.5 px-2">
                        {!isDisposed && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => openDispose(asset)}
                            title="Dispose asset"
                          >
                            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Summary row */}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3" colSpan={3}>TOTALS</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(totals.totalCost)}</td>
                  <td></td>
                  <td></td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(totals.totalAccumDep)}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(totals.totalNBV)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Capital Allowances Summary */}
      {caSummary.length > 0 && (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="px-3 py-2 bg-muted/30 border-b">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Capital Allowances (Tax Depreciation)
              </h4>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/10">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Category</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Total Cost</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Rate</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Period</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Annual Allowance</th>
                </tr>
              </thead>
              <tbody>
                {caSummary.map((row) => {
                  const catCfg = CATEGORY_CONFIG[row.category];
                  return (
                    <tr key={row.category} className="border-b border-muted/20">
                      <td className="py-1.5 px-3">
                        <Badge variant="outline" className={`text-[10px] ${catCfg.color}`}>
                          {catCfg.label}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">{eur(row.totalCost)}</td>
                      <td className="py-1.5 px-3 text-right text-xs text-muted-foreground">{row.ratePercent}%</td>
                      <td className="py-1.5 px-3 text-right text-xs text-muted-foreground">{row.periodYears} yrs</td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium">{eur(row.annualAllowance)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 font-semibold">
                  <td className="py-2 px-3">TOTAL</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {eur(caSummary.reduce((s, r) => s + r.totalCost, 0))}
                  </td>
                  <td></td>
                  <td></td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {eur(caSummary.reduce((s, r) => s + r.annualAllowance, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Add Asset Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Fixed Asset
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Asset Name</Label>
              <Input
                value={form.asset_name}
                onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
                placeholder="e.g. MacBook Pro 16-inch"
                className="h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={form.asset_category}
                  onValueChange={(v) => setForm({ ...form, asset_category: v as AssetCategory })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Date</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Purchase Cost</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.purchase_cost}
                  onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })}
                  placeholder="0.00"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Residual Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.residual_value}
                  onChange={(e) => setForm({ ...form, residual_value: e.target.value })}
                  placeholder="0.00"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Useful Life (years)</Label>
                <Input
                  type="number"
                  value={form.useful_life_years}
                  onChange={(e) => setForm({ ...form, useful_life_years: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Depreciation Method</Label>
                <Select
                  value={form.depreciation_method}
                  onValueChange={(v) => setForm({ ...form, depreciation_method: v as DepreciationMethod })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="straight_line">Straight Line</SelectItem>
                    <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.depreciation_method === "reducing_balance" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={form.depreciation_rate}
                    onChange={(e) => setForm({ ...form, depreciation_rate: e.target.value })}
                    className="h-8"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Serial number, location, condition..."
                className="w-full h-16 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!form.asset_name || !form.purchase_date || !form.purchase_cost || createAsset.isPending}
            >
              {createAsset.isPending ? "Adding..." : "Add Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose Dialog */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              Dispose: {disposeTarget?.asset_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Original Cost:</span>
              <span className="font-mono font-medium">{eur(Number(disposeTarget?.purchase_cost ?? 0))}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disposal Date</Label>
              <Input
                type="date"
                value={disposeDate}
                onChange={(e) => setDisposeDate(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Disposal Proceeds</Label>
              <Input
                type="number"
                step="0.01"
                value={disposeProceeds}
                onChange={(e) => setDisposeProceeds(e.target.value)}
                placeholder="0.00"
                className="h-8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDisposeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDispose}
              disabled={!disposeDate || disposeAsset.isPending}
            >
              {disposeAsset.isPending ? "Disposing..." : "Dispose Asset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
