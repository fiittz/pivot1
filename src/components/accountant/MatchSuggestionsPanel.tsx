import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Check,
  X,
  ArrowRightLeft,
  FileText,
  Users,
  Store,
  HelpCircle,
} from "lucide-react";
import {
  useTransactionMatcher,
  useAcceptMatch,
  useDismissMatch,
} from "@/hooks/accountant/useTransactionMatcher";
import type { MatchResult } from "@/lib/matching/transactionMatcher";
import { useCategories } from "@/hooks/useCategories";

// ────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────

const eur = (n: number) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);

type MatchType = MatchResult["match_type"];

type FilterTab = "all" | MatchType;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "transfer", label: "Transfers" },
  { value: "invoice", label: "Invoices" },
  { value: "payroll", label: "Payroll" },
  { value: "vendor_rule", label: "Vendor Rules" },
  { value: "uncategorised", label: "Uncategorised" },
];

const MATCH_TYPE_CONFIG: Record<
  MatchType,
  { label: string; color: string; bgColor: string; icon: typeof ArrowRightLeft }
> = {
  transfer: {
    label: "Transfer",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200 text-blue-700",
    icon: ArrowRightLeft,
  },
  invoice: {
    label: "Invoice",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200 text-green-700",
    icon: FileText,
  },
  payroll: {
    label: "Payroll",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200 text-purple-700",
    icon: Users,
  },
  vendor_rule: {
    label: "Vendor Rule",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200 text-amber-700",
    icon: Store,
  },
  uncategorised: {
    label: "Uncategorised",
    color: "text-gray-700",
    bgColor: "bg-gray-50 border-gray-200 text-gray-700",
    icon: HelpCircle,
  },
};

function confidenceBarColor(c: number): string {
  if (c >= 80) return "bg-green-500";
  if (c >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function confidenceTextColor(c: number): string {
  if (c >= 80) return "text-green-700";
  if (c >= 50) return "text-amber-700";
  return "text-red-700";
}

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────

interface MatchSuggestionsPanelProps {
  clientUserId: string;
  accountIds?: string[];
}

// ────────────────────────────────────────────
// Helper hook: fetch unmatched transactions as a Map
// Re-uses the same react-query cache key as useTransactionMatcher
// ────────────────────────────────────────────

function useUnmatchedTransactionMap(
  clientUserId: string | undefined,
  accountIds?: string[],
) {
  const { data } = useQuery({
    queryKey: ["unmatched-transactions", clientUserId, accountIds],
    queryFn: async () => {
      let query = supabase
        .from("bank_transactions")
        .select("id, transaction_date, description, amount")
        .eq("user_id", clientUserId!)
        .eq("is_matched", false);

      if (accountIds && accountIds.length > 0) {
        query = query.in("account_id", accountIds);
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      return rows as unknown as {
        id: string;
        transaction_date: string;
        description: string;
        amount: number;
      }[];
    },
    enabled: !!clientUserId,
    staleTime: 60 * 1000,
  });

  return useMemo(() => {
    const m = new Map<
      string,
      { transaction_date: string; description: string; amount: number }
    >();
    for (const t of data ?? []) {
      m.set(t.id, {
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
      });
    }
    return m;
  }, [data]);
}

// ────────────────────────────────────────────
// Confidence Bar
// ────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${confidenceBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span
        className={`text-xs font-medium tabular-nums ${confidenceTextColor(value)}`}
      >
        {value}%
      </span>
    </div>
  );
}

// ────────────────────────────────────────────
// Suggestion Card
// ────────────────────────────────────────────

interface SuggestionCardProps {
  result: MatchResult;
  transaction: {
    transaction_date: string;
    description: string;
    amount: number;
  };
  clientUserId: string;
}

function SuggestionCard({ result, transaction, clientUserId }: SuggestionCardProps) {
  const acceptMatch = useAcceptMatch();
  const dismissMatch = useDismissMatch();
  const { data: categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const config = MATCH_TYPE_CONFIG[result.match_type];
  const Icon = config.icon;
  const isIncome = transaction.amount > 0;

  const handleAccept = () => {
    if (result.match_type === "uncategorised" && selectedCategory) {
      const cat = categories?.find(
        (c: { id: string; name: string }) => c.id === selectedCategory,
      );
      acceptMatch.mutate({
        transaction_id: result.transaction_id,
        match_type: result.match_type,
        category_id: selectedCategory,
        category_name: cat?.name ?? "",
        matched_invoice_id: result.matched_invoice_id,
        matched_transfer_id: result.matched_transfer_id,
        user_id: clientUserId,
        description: transaction.description,
      });
    } else {
      acceptMatch.mutate({
        transaction_id: result.transaction_id,
        match_type: result.match_type,
        category_id: result.suggested_category_id,
        category_name: result.suggested_category_name,
        matched_invoice_id: result.matched_invoice_id,
        matched_transfer_id: result.matched_transfer_id,
        user_id: clientUserId,
        description: transaction.description,
      });
    }
  };

  const handleDismiss = () => {
    dismissMatch.mutate({
      transaction_id: result.transaction_id,
      user_id: clientUserId,
    });
  };

  const isMutating = acceptMatch.isPending || dismissMatch.isPending;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Top row: badge, date, description, amount */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 shrink-0 ${config.bgColor}`}
              >
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(transaction.transaction_date).toLocaleDateString("en-IE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <p className="text-sm font-medium truncate">{transaction.description}</p>
          </div>
          <span
            className={`text-sm font-semibold whitespace-nowrap ${
              isIncome ? "text-green-600" : "text-red-600"
            }`}
          >
            {isIncome ? "+" : ""}
            {eur(transaction.amount)}
          </span>
        </div>

        {/* Confidence bar */}
        <ConfidenceBar value={result.confidence} />

        {/* Match details */}
        <p className="text-xs text-muted-foreground">{result.details}</p>

        {/* Suggested category (non-uncategorised) */}
        {result.match_type !== "uncategorised" && result.suggested_category_name && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Category:
            </span>
            <Badge variant="secondary" className="text-[10px]">
              {result.suggested_category_name}
            </Badge>
          </div>
        )}

        {/* Uncategorised: category dropdown */}
        {result.match_type === "uncategorised" && (
          <div className="flex items-center gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((cat: { id: string; name: string }) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-xs">
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {result.match_type === "uncategorised" ? (
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
              disabled={!selectedCategory || isMutating}
              onClick={handleAccept}
            >
              {acceptMatch.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Apply
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
              disabled={isMutating}
              onClick={handleAccept}
            >
              {acceptMatch.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Accept
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={isMutating}
            onClick={handleDismiss}
          >
            {dismissMatch.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <X className="h-3 w-3 mr-1" />
            )}
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────
// Main Panel
// ────────────────────────────────────────────

export default function MatchSuggestionsPanel({
  clientUserId,
  accountIds,
}: MatchSuggestionsPanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const { matchResults, isLoading, isError, error, unmatchedCount } =
    useTransactionMatcher(clientUserId, accountIds);

  const transactionMap = useUnmatchedTransactionMap(clientUserId, accountIds);

  // Sort by confidence descending
  const sortedResults = useMemo(
    () => [...matchResults].sort((a, b) => b.confidence - a.confidence),
    [matchResults],
  );

  // Filter by active tab
  const filteredResults = useMemo(
    () =>
      activeTab === "all"
        ? sortedResults
        : sortedResults.filter((r) => r.match_type === activeTab),
    [sortedResults, activeTab],
  );

  // Breakdown counts by type
  const typeCounts = useMemo(() => {
    const counts: Record<MatchType, number> = {
      transfer: 0,
      invoice: 0,
      payroll: 0,
      vendor_rule: 0,
      uncategorised: 0,
    };
    for (const r of matchResults) {
      counts[r.match_type]++;
    }
    return counts;
  }, [matchResults]);

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Analysing transactions...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-red-600">
            Failed to load match suggestions:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (matchResults.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match Suggestions</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
          <p className="text-sm text-muted-foreground">
            No pending suggestions — all transactions matched!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Match Suggestions</span>
            <Badge variant="secondary" className="text-xs font-normal">
              {matchResults.length} pending
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total unmatched transactions
            </span>
            <span className="font-medium">{unmatchedCount}</span>
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-2">
            {(Object.entries(typeCounts) as [MatchType, number][])
              .filter(([, count]) => count > 0)
              .map(([type, count]) => {
                const cfg = MATCH_TYPE_CONFIG[type];
                const TypeIcon = cfg.icon;
                return (
                  <div
                    key={type}
                    className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.bgColor}`}
                  >
                    <TypeIcon className="h-3 w-3" />
                    <span>{count}</span>
                    <span>{cfg.label}</span>
                  </div>
                );
              })}
          </div>

          <p className="text-xs text-muted-foreground">
            {matchResults.length} suggestion{matchResults.length !== 1 ? "s" : ""} ready
            for review
          </p>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? matchResults.length
              : typeCounts[tab.value as MatchType] ?? 0;

          return (
            <Button
              key={tab.value}
              size="sm"
              variant={activeTab === tab.value ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1 opacity-70">({count})</span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Suggestion cards */}
      <div className="space-y-3">
        {filteredResults.map((result) => {
          const txn = transactionMap.get(result.transaction_id);
          return (
            <SuggestionCard
              key={result.transaction_id}
              result={result}
              transaction={
                txn ?? {
                  transaction_date: "",
                  description: "Loading...",
                  amount: 0,
                }
              }
              clientUserId={clientUserId}
            />
          );
        })}
        {filteredResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No suggestions for this filter.
          </p>
        )}
      </div>
    </div>
  );
}
