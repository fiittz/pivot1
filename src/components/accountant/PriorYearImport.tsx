import { useState } from "react";
import { Upload, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveYearEndSnapshot } from "@/hooks/usePriorYearSnapshot";
import { useAuth } from "@/hooks/useAuth";
import type { YearEndSnapshot } from "@/services/yearEndSnapshotService";

interface PriorYearImportProps {
  clientUserId: string;
  taxYear: number;
  onComplete?: () => void;
}

const FIELD_GROUPS = [
  {
    title: "Fixed Assets (Closing NBV)",
    fields: [
      { key: "fixed_assets_land_buildings", label: "Land & Buildings" },
      { key: "fixed_assets_plant_machinery", label: "Plant & Machinery" },
      { key: "fixed_assets_motor_vehicles", label: "Motor Vehicles" },
      { key: "fixed_assets_fixtures_fittings", label: "Fixtures & Fittings" },
    ],
  },
  {
    title: "Current Assets",
    fields: [
      { key: "stock", label: "Stock (lower of cost / NRV)" },
      { key: "work_in_progress", label: "Work in Progress" },
      { key: "debtors", label: "Trade Debtors" },
      { key: "prepayments", label: "Prepayments" },
      { key: "accrued_income", label: "Accrued Income" },
      { key: "cash", label: "Cash in Hand" },
      { key: "bank_balance", label: "Bank Balance" },
      { key: "rct_prepayment", label: "RCT Prepayment" },
    ],
  },
  {
    title: "Current Liabilities",
    fields: [
      { key: "creditors", label: "Trade Creditors" },
      { key: "accrued_expenses", label: "Accrued Expenses" },
      { key: "deferred_income", label: "Deferred Income" },
      { key: "taxation", label: "Taxation (CT due)" },
      { key: "vat_liability", label: "VAT Liability" },
      { key: "directors_loan_current", label: "Director's Loan (current)" },
    ],
  },
  {
    title: "Long-term Liabilities",
    fields: [
      { key: "bank_loans", label: "Bank Loans" },
      { key: "directors_loans", label: "Directors' Loans" },
    ],
  },
  {
    title: "Capital & Reserves",
    fields: [
      { key: "share_capital", label: "Share Capital" },
      { key: "retained_profits", label: "Retained Profits" },
    ],
  },
  {
    title: "P&L Summary",
    fields: [
      { key: "turnover", label: "Turnover" },
      { key: "total_expenses", label: "Total Expenses" },
      { key: "net_profit", label: "Net Profit / (Loss)" },
      { key: "losses_forward", label: "Losses Carried Forward" },
      { key: "capital_allowances_claimed", label: "Capital Allowances Claimed" },
    ],
  },
] as const;

type FieldKey = (typeof FIELD_GROUPS)[number]["fields"][number]["key"];

export function PriorYearImport({ clientUserId, taxYear, onComplete }: PriorYearImportProps) {
  const { user } = useAuth();
  const saveSnapshot = useSaveYearEndSnapshot();

  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const group of FIELD_GROUPS) {
      for (const field of group.fields) {
        init[field.key] = field.key === "share_capital" ? 100 : 0;
      }
    }
    return init;
  });

  const [notes, setNotes] = useState("");

  const handleChange = (key: string, raw: string) => {
    const val = parseFloat(raw) || 0;
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  // Computed totals
  const totalFixedAssets =
    values.fixed_assets_land_buildings +
    values.fixed_assets_plant_machinery +
    values.fixed_assets_motor_vehicles +
    values.fixed_assets_fixtures_fittings;

  const totalCurrentAssets =
    values.stock + values.work_in_progress + values.debtors +
    values.prepayments + values.accrued_income + values.cash +
    values.bank_balance + values.rct_prepayment;

  const totalCurrentLiabilities =
    values.creditors + values.accrued_expenses + values.deferred_income +
    values.taxation + values.vat_liability + values.directors_loan_current;

  const totalLongTermLiabilities = values.bank_loans + values.directors_loans;

  const netAssets = totalFixedAssets + totalCurrentAssets - totalCurrentLiabilities - totalLongTermLiabilities;
  const capitalReserves = values.share_capital + values.retained_profits;
  const isBalanced = Math.abs(netAssets - capitalReserves) < 0.01;

  const eur = (n: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

  const handleSave = () => {
    const snapshot: Omit<YearEndSnapshot, "id"> = {
      user_id: clientUserId,
      tax_year: taxYear,
      source: "accountant_import",
      imported_by: user?.id,

      fixed_assets_land_buildings: values.fixed_assets_land_buildings,
      fixed_assets_plant_machinery: values.fixed_assets_plant_machinery,
      fixed_assets_motor_vehicles: values.fixed_assets_motor_vehicles,
      fixed_assets_fixtures_fittings: values.fixed_assets_fixtures_fittings,

      stock: values.stock,
      work_in_progress: values.work_in_progress,
      debtors: values.debtors,
      prepayments: values.prepayments,
      accrued_income: values.accrued_income,
      cash: values.cash,
      bank_balance: values.bank_balance,
      rct_prepayment: values.rct_prepayment,

      creditors: values.creditors,
      accrued_expenses: values.accrued_expenses,
      deferred_income: values.deferred_income,
      taxation: values.taxation,
      bank_overdraft: 0,
      directors_loan_current: values.directors_loan_current,
      vat_liability: values.vat_liability,

      bank_loans: values.bank_loans,
      directors_loans: values.directors_loans,

      share_capital: values.share_capital,
      retained_profits: values.retained_profits,

      turnover: values.turnover,
      total_expenses: values.total_expenses,
      net_profit: values.net_profit,
      losses_forward: values.losses_forward,
      capital_allowances_claimed: values.capital_allowances_claimed,

      notes: notes || undefined,
    };

    saveSnapshot.mutate(snapshot, { onSuccess: () => onComplete?.() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Upload className="w-4 h-4" />
        <span>Import closing balances from prior year ({taxYear}) to seed opening balances for {taxYear + 1}</span>
      </div>

      {FIELD_GROUPS.map((group) => (
        <Card key={group.title} className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{group.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {group.fields.map((field) => (
              <div key={field.key}>
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Balance check */}
      <Card className={`border-0 shadow-sm rounded-2xl ring-2 ${isBalanced ? "ring-green-500/30" : "ring-amber-500/30"}`}>
        <CardContent className="pt-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Net Assets</span>
            <span className="font-mono">{eur(netAssets)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Capital & Reserves</span>
            <span className="font-mono">{eur(capitalReserves)}</span>
          </div>
          {!isBalanced && (
            <p className="text-xs text-amber-600 mt-1">
              Difference: {eur(netAssets - capitalReserves)} — adjust retained profits to balance
            </p>
          )}
          {isBalanced && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check className="w-3 h-3" /> Balanced
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <div>
        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Imported from Sage, year-end 31 Dec 2024"
          className="h-8 text-sm"
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={saveSnapshot.isPending}
        className="w-full"
      >
        {saveSnapshot.isPending ? "Saving..." : (
          <span className="flex items-center gap-2">
            Save Prior Year Balances <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </div>
  );
}
