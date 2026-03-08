import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, getCurrencySymbol } from "@/lib/currencyUtils";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { Globe } from "lucide-react";

interface Transaction {
  amount: number;
  currency?: string;
  type: "income" | "expense" | string;
}

interface Props {
  transactions: Transaction[];
}

interface CurrencySummary {
  currency: string;
  symbol: string;
  count: number;
  totalOriginal: number;
  totalEUR: number;
  rate: number;
}

export default function MultiCurrencyReport({ transactions }: Props) {
  const { rates, lastUpdated } = useExchangeRates();

  const summaries = useMemo(() => {
    const byCurrency = new Map<string, { count: number; total: number }>();
    for (const t of transactions) {
      const cur = t.currency || "EUR";
      const entry = byCurrency.get(cur) || { count: 0, total: 0 };
      entry.count++;
      entry.total += Math.abs(t.amount);
      byCurrency.set(cur, entry);
    }

    const result: CurrencySummary[] = [];
    for (const [currency, data] of byCurrency) {
      const rate = currency === "EUR" ? 1 : rates[currency] || 1;
      result.push({
        currency,
        symbol: getCurrencySymbol(currency),
        count: data.count,
        totalOriginal: data.total,
        totalEUR: currency === "EUR" ? data.total : data.total / rate,
        rate,
      });
    }
    return result.sort((a, b) => b.totalEUR - a.totalEUR);
  }, [transactions, rates]);

  const grandTotalEUR = summaries.reduce((s, c) => s + c.totalEUR, 0);
  const hasMultiple = summaries.length > 1;

  if (!hasMultiple) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Multi-Currency Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Currency</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Transactions</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Original</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">EUR Equivalent</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Rate</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.currency} className="border-b border-border/50">
                  <td className="px-3 py-2.5 font-medium">
                    {s.symbol} {s.currency}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{s.count}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(s.totalOriginal, s.currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(s.totalEUR, "EUR")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground text-xs">
                    {s.currency === "EUR" ? "—" : s.rate.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="px-3 py-2.5 font-semibold" colSpan={3}>Grand Total</td>
                <td className="px-3 py-2.5 text-right font-bold tabular-nums">{formatCurrency(grandTotalEUR, "EUR")}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-3">
            Rates from ECB · Updated {new Date(lastUpdated).toLocaleDateString("en-IE")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
