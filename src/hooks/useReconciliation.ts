import { useMemo } from "react";
import { useTransactions, useBulkUpdateTransactions } from "@/hooks/useTransactions";

interface ReconciliationStats {
  total: number;
  reconciled: number;
  unreconciled: number;
  reconciledPercent: number;
  reconciledAmount: number;
  unreconciledAmount: number;
  totalAmount: number;
}

export function useReconciliation() {
  const { data: allTransactions = [], isLoading } = useTransactions({ limit: 5000 });
  const bulkUpdate = useBulkUpdateTransactions();

  const stats = useMemo((): ReconciliationStats => {
    const total = allTransactions.length;
    const reconciled = allTransactions.filter((t: Record<string, unknown>) => t.is_reconciled === true).length;
    const unreconciled = total - reconciled;

    let reconciledAmount = 0;
    let unreconciledAmount = 0;

    for (const t of allTransactions as Record<string, unknown>[]) {
      const amount = Math.abs(Number(t.amount) || 0);
      if (t.is_reconciled === true) {
        reconciledAmount += amount;
      } else {
        unreconciledAmount += amount;
      }
    }

    return {
      total,
      reconciled,
      unreconciled,
      reconciledPercent: total > 0 ? Math.round((reconciled / total) * 100) : 0,
      reconciledAmount,
      unreconciledAmount,
      totalAmount: reconciledAmount + unreconciledAmount,
    };
  }, [allTransactions]);

  const unreconciledTransactions = useMemo(() => {
    return (allTransactions as Record<string, unknown>[]).filter((t) => t.is_reconciled !== true);
  }, [allTransactions]);

  const reconciledTransactions = useMemo(() => {
    return (allTransactions as Record<string, unknown>[]).filter((t) => t.is_reconciled === true);
  }, [allTransactions]);

  const markReconciled = (ids: string[]) => {
    return bulkUpdate.mutateAsync({ ids, updates: { is_reconciled: true } });
  };

  const markUnreconciled = (ids: string[]) => {
    return bulkUpdate.mutateAsync({ ids, updates: { is_reconciled: false } });
  };

  return {
    stats,
    unreconciledTransactions,
    reconciledTransactions,
    allTransactions,
    isLoading,
    markReconciled,
    markUnreconciled,
    isPending: bulkUpdate.isPending,
  };
}
