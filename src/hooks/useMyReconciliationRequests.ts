import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ReconciliationRequestLine {
  id: string;
  request_id: string;
  label: string;
  reference: string | null;
  expected_amount: number;
  confirmed_amount: number | null;
  client_status: string | null;
  client_note: string | null;
  responded_at: string | null;
  sort_order: number;
}

export interface ReconciliationRequest {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  client_user_id: string;
  request_type: string;
  title: string;
  note: string | null;
  status: string;
  as_at_date: string;
  created_at: string;
  completed_at: string | null;
  lines: ReconciliationRequestLine[];
}

// ────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────

export function useMyReconciliationRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-reconciliation-requests", user?.id],
    queryFn: async (): Promise<ReconciliationRequest[]> => {
      // Fetch pending/partially_responded reconciliation requests for the current user
      const { data: requests, error } = await supabase
        .from("reconciliation_requests")
        .select("*")
        .eq("client_user_id", user!.id)
        .in("status", ["pending", "partially_responded"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!requests || requests.length === 0) return [];

      // Fetch all lines for these requests
      const requestIds = requests.map((r: Record<string, unknown>) => r.id as string);
      const { data: lines, error: linesError } = await supabase
        .from("reconciliation_request_lines")
        .select("*")
        .in("request_id", requestIds)
        .order("sort_order", { ascending: true });

      if (linesError) throw linesError;

      // Group lines by request ID
      const linesByRequest = new Map<string, ReconciliationRequestLine[]>();
      for (const line of (lines ?? []) as unknown as ReconciliationRequestLine[]) {
        const existing = linesByRequest.get(line.request_id) ?? [];
        existing.push(line);
        linesByRequest.set(line.request_id, existing);
      }

      return (requests as unknown as Omit<ReconciliationRequest, "lines">[]).map((req) => ({
        ...req,
        lines: linesByRequest.get(req.id) ?? [],
      }));
    },
    enabled: !!user,
  });
}

// ────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────

export function useRespondToReconciliationLine() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      lineId: string;
      confirmed_amount: number | null;
      client_status: string;
      client_note: string | null;
    }) => {
      const { data, error } = await supabase
        .from("reconciliation_request_lines")
        .update({
          confirmed_amount: input.confirmed_amount,
          client_status: input.client_status,
          client_note: input.client_note,
          responded_at: new Date().toISOString(),
        })
        .eq("id", input.lineId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reconciliation-requests", user?.id] });
      toast.success("Response saved");
    },
    onError: () => {
      toast.error("Failed to save response");
    },
  });
}

export function useCompleteReconciliation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { requestId: string }) => {
      const { data, error } = await supabase
        .from("reconciliation_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", input.requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reconciliation-requests", user?.id] });
      toast.success("All responses submitted");
    },
    onError: () => {
      toast.error("Failed to complete reconciliation");
    },
  });
}
