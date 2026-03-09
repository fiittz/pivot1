import { useState } from "react";
import { HelpCircle, AlertTriangle, Flag, Send, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyTrialBalanceFlags, useRespondToTBFlag } from "@/hooks/useMyTrialBalanceFlags";

const FLAG_ICONS = {
  query: HelpCircle,
  warning: AlertTriangle,
  adjustment_needed: Flag,
};

const FLAG_COLORS = {
  query: "text-blue-500",
  warning: "text-amber-500",
  adjustment_needed: "text-red-500",
};

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

/**
 * Shown on the client's dashboard when their accountant has flagged
 * trial balance items that need a response.
 */
export function TrialBalanceFlagsBanner() {
  const { data: flags = [] } = useMyTrialBalanceFlags();
  const respond = useRespondToTBFlag();
  const [responses, setResponses] = useState<Record<string, string>>({});

  if (flags.length === 0) return null;

  const warningCount = flags.filter((f) => f.flag_type === "warning" || f.flag_type === "adjustment_needed").length;

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
        warningCount > 0
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50"
          : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50"
      }`}>
        <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
          warningCount > 0
            ? "bg-amber-100 dark:bg-amber-900/50"
            : "bg-blue-100 dark:bg-blue-900/50"
        }`}>
          <MessageSquare className={`w-5 h-5 ${
            warningCount > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-blue-600 dark:text-blue-400"
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${
            warningCount > 0
              ? "text-amber-900 dark:text-amber-200"
              : "text-blue-900 dark:text-blue-200"
          }`}>
            {flags.length} {flags.length === 1 ? "question" : "questions"} from your accountant
          </p>
          <p className={`text-xs ${
            warningCount > 0
              ? "text-amber-700 dark:text-amber-400"
              : "text-blue-700 dark:text-blue-400"
          }`}>
            Please review and respond to the flagged items on your trial balance.
          </p>
        </div>
        <Badge className={`rounded-full px-2.5 text-xs shrink-0 ${
          warningCount > 0
            ? "bg-amber-600 hover:bg-amber-700 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}>
          {flags.length} Flag{flags.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Individual flags */}
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {flags.map((flag) => {
            const Icon = FLAG_ICONS[flag.flag_type as keyof typeof FLAG_ICONS] ?? Flag;
            const iconColor = FLAG_COLORS[flag.flag_type as keyof typeof FLAG_COLORS] ?? "text-muted-foreground";
            const response = responses[flag.id] ?? "";

            return (
              <div key={flag.id} className="space-y-2 rounded-xl border border-muted/30 p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                <div className="flex items-start gap-2">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{flag.account_name}</span>
                      <span className="text-xs font-mono tabular-nums text-muted-foreground">
                        {eur(flag.flagged_amount)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{flag.note}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <textarea
                    value={response}
                    onChange={(e) => setResponses((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                    placeholder="Type your response..."
                    className="flex-1 text-sm rounded-md border bg-background px-2 py-1.5 resize-none h-8 focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1"
                    disabled={!response.trim() || respond.isPending}
                    onClick={() =>
                      respond.mutate(
                        { flagId: flag.id, response },
                        {
                          onSuccess: () =>
                            setResponses((prev) => {
                              const next = { ...prev };
                              delete next[flag.id];
                              return next;
                            }),
                        },
                      )
                    }
                  >
                    <Send className="w-3 h-3" />
                    Reply
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
