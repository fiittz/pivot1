import { useMemo, useState, useCallback } from "react";

export interface Insight {
  id: string;
  type: "duplicate" | "unusual_amount" | "stale_uncategorized";
  title: string;
  description: string;
  transactionIds: string[];
  severity: "warning" | "info";
}

const STORAGE_KEY = "balnce-dismissed-insights";

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function useAnomalyDetection(transactions: Record<string, unknown>[]) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const dismissInsight = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
      return next;
    });
  }, []);

  const insights = useMemo(() => {
    if (!transactions.length) return [];
    const results: Insight[] = [];

    // 1. Duplicate detection: same description + same amount within 3 days
    const txByKey = new Map<string, Record<string, unknown>[]>();
    for (const t of transactions) {
      const key = `${String(t.description || "").toLowerCase().trim()}|${Math.abs(Number(t.amount) || 0).toFixed(2)}`;
      const group = txByKey.get(key) || [];
      group.push(t);
      txByKey.set(key, group);
    }
    for (const [, group] of txByKey) {
      if (group.length < 2) continue;
      // Check if any pair is within 3 days
      for (let i = 0; i < group.length - 1; i++) {
        const d1 = new Date(String(group[i].transaction_date || "")).getTime();
        const d2 = new Date(String(group[i + 1].transaction_date || "")).getTime();
        if (Math.abs(d1 - d2) <= 3 * 86400000) {
          const ids = [group[i].id as string, group[i + 1].id as string];
          const insightId = `dup-${ids.sort().join("-")}`;
          if (!results.some((r) => r.id === insightId)) {
            results.push({
              id: insightId,
              type: "duplicate",
              title: "Possible duplicate",
              description: `"${group[i].description}" for €${Math.abs(Number(group[i].amount) || 0).toFixed(2)} appears ${group.length} times within 3 days`,
              transactionIds: ids,
              severity: "warning",
            });
          }
        }
      }
    }

    // 2. Unusual amount: >2 std deviations from vendor average
    const vendorAmounts = new Map<string, number[]>();
    for (const t of transactions) {
      const vendor = String(t.description || "").toLowerCase().trim();
      if (!vendor) continue;
      const amounts = vendorAmounts.get(vendor) || [];
      amounts.push(Math.abs(Number(t.amount) || 0));
      vendorAmounts.set(vendor, amounts);
    }
    for (const [vendor, amounts] of vendorAmounts) {
      if (amounts.length < 4) continue; // Need enough data
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(amounts.reduce((sum, a) => sum + (a - mean) ** 2, 0) / amounts.length);
      if (stdDev === 0) continue;

      for (const t of transactions) {
        if (String(t.description || "").toLowerCase().trim() !== vendor) continue;
        const amt = Math.abs(Number(t.amount) || 0);
        if (Math.abs(amt - mean) > 2 * stdDev) {
          const insightId = `unusual-${t.id}`;
          results.push({
            id: insightId,
            type: "unusual_amount",
            title: "Unusual amount",
            description: `€${amt.toFixed(2)} from "${t.description}" is unusual (avg €${mean.toFixed(2)})`,
            transactionIds: [t.id as string],
            severity: "warning",
          });
        }
      }
    }

    // 3. Stale uncategorized: uncategorized for >7 days
    const now = Date.now();
    const staleIds: string[] = [];
    for (const t of transactions) {
      if (t.category_id) continue;
      const created = new Date(String(t.created_at || t.transaction_date || "")).getTime();
      if (now - created > 7 * 86400000) {
        staleIds.push(t.id as string);
      }
    }
    if (staleIds.length > 0) {
      results.push({
        id: "stale-uncategorized",
        type: "stale_uncategorized",
        title: "Uncategorized transactions aging",
        description: `${staleIds.length} transaction${staleIds.length !== 1 ? "s have" : " has"} been uncategorized for over a week`,
        transactionIds: staleIds.slice(0, 5),
        severity: "info",
      });
    }

    return results.filter((r) => !dismissedIds.has(r.id));
  }, [transactions, dismissedIds]);

  return { insights, dismissInsight, isLoading: false };
}
