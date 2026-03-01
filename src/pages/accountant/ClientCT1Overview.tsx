import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import type { CT1Data } from "@/hooks/useCT1Data";

interface ClientCT1OverviewProps {
  ct1Data: CT1Data;
  isLoading: boolean;
}

const ClientCT1Overview = ({ ct1Data, isLoading }: ClientCT1OverviewProps) => {
  const totalIncome = ct1Data.detectedIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = ct1Data.expenseSummary.allowable + ct1Data.expenseSummary.disallowed;

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading client data...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Financial summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-600">
              {formatCurrency(totalIncome)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-red-600">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${ct1Data.closingBalance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatCurrency(ct1Data.closingBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income breakdown */}
      {ct1Data.detectedIncome.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ct1Data.detectedIncome.map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.category}</span>
                  <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allowable</span>
                <span className="font-medium text-emerald-600">
                  {formatCurrency(ct1Data.expenseSummary.allowable)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Disallowed</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(ct1Data.expenseSummary.disallowed)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {ct1Data.disallowedByCategory.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disallowed by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {ct1Data.disallowedByCategory.slice(0, 5).map((item) => (
                  <div key={item.category} className="flex justify-between">
                    <span className="text-muted-foreground truncate">{item.category}</span>
                    <span className="font-medium text-red-600">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Flagged capital items */}
      {ct1Data.flaggedCapitalItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Flagged Capital Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {ct1Data.flaggedCapitalItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <span className="text-foreground">{item.description}</span>
                    <span className="text-muted-foreground ml-2">{item.date}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default ClientCT1Overview;
