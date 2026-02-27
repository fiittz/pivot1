import { useMemo } from "react";
import { useAccountantClients } from "@/hooks/accountant/useAccountantClients";
import { buildClientDeadlines, type AccountantDeadline } from "@/lib/accountant/deadlineCalculations";

export function useDashboardDeadlines() {
  const { data: clients, isLoading } = useAccountantClients({ status: "active" });

  const deadlines = useMemo<AccountantDeadline[]>(() => {
    if (!clients?.length) return [];
    const now = new Date();
    return buildClientDeadlines(clients, now);
  }, [clients]);

  return { deadlines, isLoading };
}
