import { useMemo } from "react";

interface Transaction {
  category_id?: string | null;
  ai_confidence?: number;
  ai_categorized?: boolean;
  user_corrected?: boolean;
}

interface CategorizationStats {
  totalTransactions: number;
  categorized: number;
  uncategorized: number;
  aiCategorized: number;
  userCorrected: number;
  categorizationRate: number;
  aiAccuracy: number;
  confidenceDistribution: { high: number; medium: number; low: number };
}

export function useCategorizationStats(transactions: Transaction[]): CategorizationStats {
  return useMemo(() => {
    const total = transactions.length;
    if (!total) {
      return {
        totalTransactions: 0,
        categorized: 0,
        uncategorized: 0,
        aiCategorized: 0,
        userCorrected: 0,
        categorizationRate: 0,
        aiAccuracy: 0,
        confidenceDistribution: { high: 0, medium: 0, low: 0 },
      };
    }

    const categorized = transactions.filter((t) => t.category_id).length;
    const uncategorized = total - categorized;
    const aiCategorized = transactions.filter((t) => t.ai_categorized).length;
    const userCorrected = transactions.filter((t) => t.user_corrected).length;

    const aiAccuracy = aiCategorized > 0
      ? Math.round(((aiCategorized - userCorrected) / aiCategorized) * 100)
      : 0;

    let high = 0, medium = 0, low = 0;
    for (const t of transactions) {
      const conf = t.ai_confidence ?? (t.category_id ? 0.85 : 0);
      if (conf >= 0.8) high++;
      else if (conf >= 0.5) medium++;
      else low++;
    }

    return {
      totalTransactions: total,
      categorized,
      uncategorized,
      aiCategorized,
      userCorrected,
      categorizationRate: Math.round((categorized / total) * 100),
      aiAccuracy: Math.max(0, aiAccuracy),
      confidenceDistribution: { high, medium, low },
    };
  }, [transactions]);
}
