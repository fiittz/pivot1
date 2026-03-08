import { BarChart3, AlertCircle, Users, FileCheck, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PracticeKPIs } from "@/hooks/accountant/usePracticeKPIs";

function getRateColor(rate: number) {
  if (rate >= 80) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function getRateBg(rate: number) {
  if (rate >= 80) return "bg-green-100 dark:bg-green-950/40";
  if (rate >= 50) return "bg-amber-100 dark:bg-amber-950/40";
  return "bg-red-100 dark:bg-red-950/40";
}

interface Props {
  kpis: PracticeKPIs;
}

export function PracticeHealthCards({ kpis }: Props) {
  const cards = [
    {
      label: "Categorization Rate",
      value: `${kpis.averageCategorizationRate}%`,
      icon: BarChart3,
      color: getRateColor(kpis.averageCategorizationRate),
      bg: getRateBg(kpis.averageCategorizationRate),
    },
    {
      label: "Uncategorized Backlog",
      value: String(kpis.totalUncategorizedTransactions),
      icon: AlertCircle,
      color: kpis.totalUncategorizedTransactions > 50 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
      bg: kpis.totalUncategorizedTransactions > 50 ? "bg-red-100 dark:bg-red-950/40" : "bg-muted",
    },
    {
      label: "Clients Needing Attention",
      value: String(kpis.clientsNeedingAttention.length),
      icon: Users,
      color: kpis.clientsNeedingAttention.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400",
      bg: kpis.clientsNeedingAttention.length > 0 ? "bg-amber-100 dark:bg-amber-950/40" : "bg-green-100 dark:bg-green-950/40",
    },
    {
      label: "Active Clients",
      value: String(kpis.totalClients),
      icon: FileCheck,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-950/40",
    },
    {
      label: "Receipt Coverage",
      value: `${kpis.receiptCoverage}%`,
      icon: Receipt,
      color: getRateColor(kpis.receiptCoverage),
      bg: getRateBg(kpis.receiptCoverage),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="py-4 px-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg}`}>
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground">{card.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
