import { useState } from "react";
import { HelpCircle, AlertTriangle, Flag, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMyTrialBalanceFlags, useRespondToTBFlag } from "@/hooks/useMyTrialBalanceFlags";

const FLAG_ICONS = {
  query: HelpCircle,
  warning: AlertTriangle,
  adjustment_needed: Flag,
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

  return (
    <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          Your accountant has {flags.length} {flags.length === 1 ? "question" : "questions"} about your accounts
        </h3>

        {flags.map((flag) => {
          const Icon = FLAG_ICONS[flag.flag_type as keyof typeof FLAG_ICONS] ?? Flag;
          const response = responses[flag.id] ?? "";

          return (
            <div key={flag.id} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <Icon className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{flag.account_name}</span>
                    <span className="text-xs font-mono text-muted-foreground">
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
                  className="flex-1 text-sm rounded-md border px-2 py-1.5 resize-none h-8 focus:outline-none focus:ring-2 focus:ring-ring"
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
  );
}
