import { useState, useMemo } from "react";
import {
  Banknote,
  Plus,
  CheckCircle2,
  FileCheck,
  Loader2,
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
  useEmployees,
  useDividends,
  useDeclareDividend,
  useMarkDividendPaid,
  useMarkDWTFiled,
  type DividendDeclaration,
} from "@/hooks/accountant/usePayroll";

interface DividendManagerProps {
  clientUserId: string;
  taxYear: number;
}

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

function formatDwtDueDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** DWT is due by the 14th of the month following payment */
function computeDwtDueDate(paymentDate: string): string {
  try {
    const d = new Date(paymentDate);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 14);
    return nextMonth.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "N/A";
  }
}

type DividendStatus = "declared" | "paid" | "dwt_filed";

const STATUS_CONFIG: Record<DividendStatus, { label: string; color: string }> = {
  declared: { label: "Declared", color: "bg-blue-100 text-blue-700 border-blue-200" },
  paid: { label: "Paid", color: "bg-green-100 text-green-700 border-green-200" },
  dwt_filed: { label: "DWT Filed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

type DividendFormState = {
  recipient_name: string;
  recipient_ppsn: string;
  employee_id: string;
  gross_amount: string;
  dwt_rate: string;
  declaration_date: string;
  payment_date: string;
  board_resolution_ref: string;
  notes: string;
};

const defaultForm: DividendFormState = {
  recipient_name: "",
  recipient_ppsn: "",
  employee_id: "",
  gross_amount: "",
  dwt_rate: "25",
  declaration_date: "",
  payment_date: "",
  board_resolution_ref: "",
  notes: "",
};

export function DividendManager({ clientUserId, taxYear }: DividendManagerProps) {
  const { data: employees } = useEmployees(clientUserId);
  const { data: dividends, isLoading } = useDividends(clientUserId, taxYear);
  const declareDividend = useDeclareDividend();
  const markPaid = useMarkDividendPaid();
  const markDwtFiled = useMarkDWTFiled();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DividendFormState>(defaultForm);

  const directors = useMemo(
    () => (employees ?? []).filter((e) => e.is_director && e.is_active),
    [employees],
  );

  const resetForm = () => setForm(defaultForm);

  const openDeclare = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleRecipientSelect = (employeeId: string) => {
    if (employeeId === "__custom__") {
      setForm({
        ...form,
        employee_id: "",
        recipient_name: "",
        recipient_ppsn: "",
      });
      return;
    }
    const emp = directors.find((d) => d.id === employeeId);
    if (emp) {
      setForm({
        ...form,
        employee_id: emp.id,
        recipient_name: `${emp.first_name} ${emp.last_name}`,
        recipient_ppsn: emp.ppsn,
      });
    }
  };

  // Live calculation
  const grossAmount = parseFloat(form.gross_amount) || 0;
  const dwtRate = parseFloat(form.dwt_rate) || 25;
  const dwtAmount = grossAmount * (dwtRate / 100);
  const netAmount = grossAmount - dwtAmount;

  const handleDeclare = () => {
    declareDividend.mutate(
      {
        user_id: clientUserId,
        tax_year: taxYear,
        recipient_name: form.recipient_name,
        recipient_ppsn: form.recipient_ppsn || undefined,
        employee_id: form.employee_id || undefined,
        gross_amount: grossAmount,
        dwt_rate: dwtRate,
        declaration_date: form.declaration_date,
        payment_date: form.payment_date || undefined,
        board_resolution_ref: form.board_resolution_ref || undefined,
        notes: form.notes || undefined,
      },
      { onSuccess: () => { setDialogOpen(false); resetForm(); } },
    );
  };

  const handleMarkPaid = (div: DividendDeclaration) => {
    markPaid.mutate({
      id: div.id,
      user_id: clientUserId,
      tax_year: taxYear,
      payment_date: new Date().toISOString().slice(0, 10),
    });
  };

  const handleMarkDwtFiled = (div: DividendDeclaration) => {
    markDwtFiled.mutate({
      id: div.id,
      user_id: clientUserId,
      tax_year: taxYear,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dividends...</span>
      </div>
    );
  }

  const allDividends = dividends ?? [];
  const totalGross = allDividends.reduce((s, d) => s + Number(d.gross_amount), 0);
  const totalDwt = allDividends.reduce((s, d) => s + Number(d.dwt_amount), 0);
  const totalNet = allDividends.reduce((s, d) => s + Number(d.net_amount), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Banknote className="w-5 h-5 text-primary" />
            Dividends
          </h3>
          <p className="text-xs text-muted-foreground">
            {taxYear} &middot; {allDividends.length} dividend{allDividends.length !== 1 ? "s" : ""}
            {totalGross > 0 && <> &middot; Total gross: {eur(totalGross)}</>}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openDeclare}>
          <Plus className="w-3.5 h-3.5" />
          Declare Dividend
        </Button>
      </div>

      {/* Dividends table */}
      {allDividends.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No dividends declared for {taxYear}. Click &quot;Declare Dividend&quot; to start.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Recipient</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Declaration</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Gross</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">DWT ({allDividends[0]?.dwt_rate ?? 25}%)</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Net</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Payment Date</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">DWT Due</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Status</th>
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allDividends.map((div) => {
                  const statusCfg = STATUS_CONFIG[div.status] ?? STATUS_CONFIG.declared;
                  return (
                    <tr
                      key={div.id}
                      className="border-b border-muted/20 hover:bg-muted/10 transition-colors"
                    >
                      <td className="py-1.5 px-3 font-medium">{div.recipient_name}</td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {formatDate(div.declaration_date)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                        {eur(Number(div.gross_amount))}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-red-600">
                        -{eur(Number(div.dwt_amount))}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-medium text-emerald-700">
                        {eur(Number(div.net_amount))}
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {div.payment_date ? formatDate(div.payment_date) : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground">
                        {div.dwt_due_date ? formatDwtDueDate(div.dwt_due_date) : "\u2014"}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${statusCfg.color}`}>
                          {statusCfg.label}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {div.status === "declared" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs gap-1"
                              onClick={() => handleMarkPaid(div)}
                              disabled={markPaid.isPending}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Mark Paid
                            </Button>
                          )}
                          {div.status === "paid" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleMarkDwtFiled(div)}
                              disabled={markDwtFiled.isPending}
                            >
                              <FileCheck className="w-3 h-3" />
                              DWT Filed
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                {allDividends.length > 1 && (
                  <tr className="border-t-2 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>TOTALS</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">{eur(totalGross)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-red-600">-{eur(totalDwt)}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">{eur(totalNet)}</td>
                    <td colSpan={4}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Declare Dividend Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Declare Dividend
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Recipient selection */}
            <div className="space-y-1.5">
              <Label className="text-xs">Recipient</Label>
              <Select
                value={form.employee_id || "__custom__"}
                onValueChange={handleRecipientSelect}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select director or enter manually" />
                </SelectTrigger>
                <SelectContent>
                  {directors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.first_name} {d.last_name}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Enter manually...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Manual name + PPSN */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Recipient Name</Label>
                <Input
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                  placeholder="John Smith"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Recipient PPSN</Label>
                <Input
                  value={form.recipient_ppsn}
                  onChange={(e) => setForm({ ...form, recipient_ppsn: e.target.value })}
                  placeholder="1234567AB"
                  className="h-8 font-mono"
                />
              </div>
            </div>

            {/* Gross amount + DWT rate */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Gross Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.gross_amount}
                  onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
                  placeholder="10000.00"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">DWT Rate (%)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.dwt_rate}
                  onChange={(e) => setForm({ ...form, dwt_rate: e.target.value })}
                  placeholder="25"
                  className="h-8"
                />
              </div>
            </div>

            {/* Live calculation */}
            {grossAmount > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Gross Dividend:</span>
                    <span className="font-mono tabular-nums font-medium">{eur(grossAmount)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>DWT ({dwtRate}%):</span>
                    <span className="font-mono tabular-nums">-{eur(dwtAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-700 border-t pt-1">
                    <span>Net to Director:</span>
                    <span className="font-mono tabular-nums">{eur(netAmount)}</span>
                  </div>
                  {form.payment_date && (
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>DWT due by:</span>
                      <span>{computeDwtDueDate(form.payment_date)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Declaration Date</Label>
                <Input
                  type="date"
                  value={form.declaration_date}
                  onChange={(e) => setForm({ ...form, declaration_date: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Date (optional)</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>

            {/* Board resolution + notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Board Resolution Reference (optional)</Label>
              <Input
                value={form.board_resolution_ref}
                onChange={(e) => setForm({ ...form, board_resolution_ref: e.target.value })}
                placeholder="BR-2026-001"
                className="h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
                className="w-full h-16 text-sm rounded-md border px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDeclare}
              disabled={
                !form.recipient_name ||
                grossAmount <= 0 ||
                !form.declaration_date ||
                declareDividend.isPending
              }
            >
              {declareDividend.isPending ? "Declaring..." : "Declare Dividend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
