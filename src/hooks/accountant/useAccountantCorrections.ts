import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth.tsx";
import {
  recordAccountantCorrection,
  loadAccountantCorrections,
} from "@/services/accountantCorrectionService";

interface CorrectionInput {
  clientUserId: string;
  accountantClientId: string;
  transactionDescription: string;
  transactionAmount: number | null;
  transactionType: string | null;
  originalCategory: string | null;
  originalCategoryId: string | null;
  correctedCategory: string;
  correctedCategoryId: string;
  originalVatRate: number | null;
  correctedVatRate: number | null;
  clientIndustry: string | null;
  clientBusinessType: string | null;
}

/**
 * Hook for recording accountant corrections when they recategorise a client's transaction.
 * Automatically enriches with practice context from auth.
 */
export function useRecordAccountantCorrection() {
  const { user, practice } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CorrectionInput) => {
      if (!user?.id || !practice?.id) {
        throw new Error("Accountant must be logged in with a practice");
      }

      await recordAccountantCorrection({
        accountantId: user.id,
        practiceId: practice.id,
        ...input,
      });
    },
    onSuccess: (_data, variables) => {
      // Invalidate relevant queries so UI reflects the change
      queryClient.invalidateQueries({
        queryKey: ["accountant-corrections", user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["client-transactions", variables.clientUserId],
      });
    },
  });
}

/**
 * Hook to load an accountant's corrections, optionally filtered by client.
 */
export function useAccountantCorrections(clientUserId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-corrections", user?.id, clientUserId],
    queryFn: () => loadAccountantCorrections(user!.id, clientUserId),
    enabled: !!user?.id,
  });
}
