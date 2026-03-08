import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { isVATDeductible, calculateVATFromGross } from "@/lib/vatDeductibility";

interface VATReturnsViewProps {
  clientUserId: string;
  taxYear: number;
}

// Irish VAT bi-monthly periods
const VAT_PERIODS = [
  { label: "Jan-Feb", startMonth: 0, endMonth: 1 },
  { label: "Mar-Apr", startMonth: 2, endMonth: 3 },
  { label: "May-Jun", startMonth: 4, endMonth: 5 },
  { label: "Jul-Aug", startMonth: 6, endMonth: 7 },
  { label: "Sep-Oct", startMonth: 8, endMonth: 9 },
  { label: "Nov-Dec", startMonth: 10, endMonth: 11 },
] as const;

interface PeriodData {
  label: string;
  periodStart: string;
  periodEnd: string;
  salesExVat: number;
  outputVat: number;
  purchasesExVat: number;
  inputVat: number;
  netVat: number;
  dueDate: Date;
  status: "filed" | "due" | "overdue" | "not_due";
  filedReturnId?: string;
}

const eur = (n: number) =>
  n === 0
    ? "\u2014"
    : new Intl.NumberFormat("en-IE", {
        style: "currency",
        currency: "EUR",
      }).format(n);

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  filed: { variant: "default", label: "Filed" },
  due: { variant: "secondary", label: "Due" },
  overdue: { variant: "destructive", label: "Overdue" },
  not_due: { variant: "outline", label: "Not Due" },
};

function getLastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month + 1, 0);
  return d.toISOString().split("T")[0];
}

function getFirstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function VATReturnsView({ clientUserId, taxYear }: VATReturnsViewProps) {
  // Fetch transactions for the entire year
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;

  const { data: transactions, isLoading: txnLoading } = useQuery({
    queryKey: ["client-vat-transactions", clientUserId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          type,
          amount,
          vat_amount,
          vat_rate,
          description,
          transaction_date,
          category:categories(name),
          account:accounts(name)
        `,
        )
        .eq("user_id", clientUserId)
        .gte("transaction_date", yearStart)
        .lte("transaction_date", yearEnd)
        .order("transaction_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!clientUserId,
  });

  // Fetch invoices for sales VAT
  const { data: invoices, isLoading: invLoading } = useQuery({
    queryKey: ["client-vat-invoices", clientUserId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_date, vat_amount, total, subtotal")
        .eq("user_id", clientUserId)
        .gte("invoice_date", yearStart)
        .lte("invoice_date", yearEnd)
        .in("status", ["sent", "paid"]);

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!clientUserId,
  });

  // Fetch expenses for input VAT
  const { data: expenses, isLoading: expLoading } = useQuery({
    queryKey: ["client-vat-expenses", clientUserId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, expense_date, amount, vat_amount")
        .eq("user_id", clientUserId)
        .gte("expense_date", yearStart)
        .lte("expense_date", yearEnd);

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!clientUserId,
  });

  // Fetch filed VAT returns to determine status
  const { data: filedReturns, isLoading: returnsLoading } = useQuery({
    queryKey: ["client-vat-returns", clientUserId, taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_returns")
        .select("*")
        .eq("user_id", clientUserId)
        .gte("period_start", yearStart)
        .lte("period_end", yearEnd);

      if (error) throw error;
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!clientUserId,
  });

  const isLoading = txnLoading || invLoading || expLoading || returnsLoading;

  const periods = useMemo((): PeriodData[] => {
    if (!transactions || !invoices || !expenses) return [];

    const now = new Date();

    return VAT_PERIODS.map((period) => {
      const periodStart = getFirstDayOfMonth(taxYear, period.startMonth);
      const periodEnd = getLastDayOfMonth(taxYear, period.endMonth);

      // VAT3 return due on 23rd of month following period end
      const dueMonth = period.endMonth + 1; // 0-indexed next month
      const dueYear = dueMonth > 11 ? taxYear + 1 : taxYear;
      const dueMonthActual = dueMonth > 11 ? 0 : dueMonth;
      const dueDate = new Date(dueYear, dueMonthActual, 23);

      // Calculate sales from invoices in this period
      let salesExVat = 0;
      let outputVat = 0;
      for (const inv of invoices) {
        const invDate = inv.invoice_date as string;
        if (invDate >= periodStart && invDate <= periodEnd) {
          const vatAmt = Number(inv.vat_amount ?? 0);
          const total = Number(inv.total ?? 0);
          const subtotal = Number(inv.subtotal ?? total - vatAmt);
          salesExVat += subtotal;
          outputVat += vatAmt;
        }
      }

      // Add income transactions (for sales not captured by invoices)
      for (const txn of transactions) {
        const txnDate = txn.transaction_date as string;
        if (txnDate < periodStart || txnDate > periodEnd) continue;
        if (txn.type !== "income") continue;

        const isReverseCharge =
          txn.vat_rate === "reverse_charge" || txn.vat_rate === "Reverse Charge";
        let vatAmount = isReverseCharge ? 0 : Number(txn.vat_amount ?? 0);
        if (
          !vatAmount &&
          !isReverseCharge &&
          txn.vat_rate &&
          txn.vat_rate !== "exempt" &&
          txn.vat_rate !== "zero_rated"
        ) {
          const calculated = calculateVATFromGross(
            Math.abs(Number(txn.amount)),
            txn.vat_rate as string,
          );
          vatAmount = calculated.vatAmount;
        }

        if (vatAmount > 0) {
          const grossAmount = Math.abs(Number(txn.amount));
          salesExVat += grossAmount - vatAmount;
          outputVat += vatAmount;
        }
      }

      // Calculate purchases from expenses
      let purchasesExVat = 0;
      let inputVat = 0;
      for (const exp of expenses) {
        const expDate = exp.expense_date as string;
        if (expDate >= periodStart && expDate <= periodEnd) {
          const vat = Number(exp.vat_amount ?? 0);
          const amount = Math.abs(Number(exp.amount ?? 0));
          purchasesExVat += amount - vat;
          inputVat += vat;
        }
      }

      // Add expense transactions
      for (const txn of transactions) {
        const txnDate = txn.transaction_date as string;
        if (txnDate < periodStart || txnDate > periodEnd) continue;
        if (txn.type !== "expense") continue;

        const categoryName = (txn.category as { name: string } | null)?.name ?? null;
        const accountName = (txn.account as { name: string } | null)?.name ?? null;

        const isReverseCharge =
          txn.vat_rate === "reverse_charge" || txn.vat_rate === "Reverse Charge";
        let vatAmount = isReverseCharge ? 0 : Number(txn.vat_amount ?? 0);
        if (
          !vatAmount &&
          !isReverseCharge &&
          txn.vat_rate &&
          txn.vat_rate !== "exempt" &&
          txn.vat_rate !== "zero_rated"
        ) {
          const calculated = calculateVATFromGross(
            Math.abs(Number(txn.amount)),
            txn.vat_rate as string,
          );
          vatAmount = calculated.vatAmount;
        }

        const deductibility = isVATDeductible(
          (txn.description as string) ?? "",
          categoryName,
          accountName,
        );
        if (deductibility.isDeductible && vatAmount > 0) {
          const grossAmount = Math.abs(Number(txn.amount));
          purchasesExVat += grossAmount - vatAmount;
          inputVat += vatAmount;
        }
      }

      const netVat = outputVat - inputVat;

      // Determine status
      const filedReturn = (filedReturns ?? []).find(
        (r) =>
          (r.period_start as string) === periodStart &&
          (r.period_end as string) === periodEnd &&
          ((r.status as string) === "submitted" || (r.status as string) === "paid"),
      );

      let status: PeriodData["status"];
      if (filedReturn) {
        status = "filed";
      } else if (now > dueDate) {
        // Only overdue if the period has actually ended
        const periodEndDate = new Date(periodEnd);
        status = now > periodEndDate ? "overdue" : "not_due";
      } else {
        // Period has ended but due date hasn't passed yet
        const periodEndDate = new Date(periodEnd);
        status = now > periodEndDate ? "due" : "not_due";
      }

      return {
        label: period.label,
        periodStart,
        periodEnd,
        salesExVat,
        outputVat,
        purchasesExVat,
        inputVat,
        netVat,
        dueDate,
        status,
        filedReturnId: filedReturn?.id as string | undefined,
      };
    });
  }, [transactions, invoices, expenses, filedReturns, taxYear]);

  const totals = useMemo(() => {
    return periods.reduce(
      (acc, p) => ({
        salesExVat: acc.salesExVat + p.salesExVat,
        outputVat: acc.outputVat + p.outputVat,
        purchasesExVat: acc.purchasesExVat + p.purchasesExVat,
        inputVat: acc.inputVat + p.inputVat,
        netVat: acc.netVat + p.netVat,
      }),
      { salesExVat: 0, outputVat: 0, purchasesExVat: 0, inputVat: 0, netVat: 0 },
    );
  }, [periods]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Total Output VAT
            </div>
            <p className="text-2xl font-semibold">{eur(totals.outputVat)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              Total Input VAT
            </div>
            <p className="text-2xl font-semibold">{eur(totals.inputVat)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Scale className="w-4 h-4 text-orange-500" />
              Net Position
            </div>
            <p
              className={`text-2xl font-semibold ${
                totals.netVat >= 0 ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {totals.netVat >= 0 ? eur(totals.netVat) : `(${eur(Math.abs(totals.netVat))})`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.netVat >= 0 ? "Payable to Revenue" : "Refundable from Revenue"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Period Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">VAT Returns {taxYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Sales (ex VAT)</TableHead>
                <TableHead className="text-right">Output VAT</TableHead>
                <TableHead className="text-right">Purchases (ex VAT)</TableHead>
                <TableHead className="text-right">Input VAT</TableHead>
                <TableHead className="text-right">Net VAT</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((p) => {
                const badge = STATUS_BADGE[p.status];
                return (
                  <TableRow key={p.label}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(p.salesExVat)}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(p.outputVat)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {eur(p.purchasesExVat)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{eur(p.inputVat)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-medium ${
                        p.netVat > 0
                          ? "text-red-600"
                          : p.netVat < 0
                            ? "text-emerald-600"
                            : ""
                      }`}
                    >
                      {p.netVat < 0 ? `(${eur(Math.abs(p.netVat))})` : eur(p.netVat)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals Row */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">
                  {eur(totals.salesExVat)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {eur(totals.outputVat)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {eur(totals.purchasesExVat)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {eur(totals.inputVat)}
                </TableCell>
                <TableCell
                  className={`text-right tabular-nums ${
                    totals.netVat > 0
                      ? "text-red-600"
                      : totals.netVat < 0
                        ? "text-emerald-600"
                        : ""
                  }`}
                >
                  {totals.netVat < 0
                    ? `(${eur(Math.abs(totals.netVat))})`
                    : eur(totals.netVat)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
