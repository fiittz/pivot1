import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FilingRecord, FilingType, FilingStatus } from "@/types/accountant";

// ── Per-client filing list ───────────────────────────────────

export function useClientFilings(accountantClientId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["filing-records", "by-client", accountantClientId],
    queryFn: async (): Promise<FilingRecord[]> => {
      const { data, error } = await supabase
        .from("filing_records")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("tax_period_start", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as FilingRecord[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

// ── Single filing by ID ──────────────────────────────────────

export function useFilingRecord(filingId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["filing-records", "detail", filingId],
    queryFn: async (): Promise<FilingRecord | null> => {
      const { data, error } = await supabase
        .from("filing_records")
        .select("*")
        .eq("id", filingId!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as FilingRecord | null;
    },
    enabled: !!user && !!filingId,
  });
}

// ── Cross-client filing counts (for dashboard) ──────────────

export function useFilingCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["filing-records", "counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filing_records")
        .select("status")
        .eq("accountant_id", user!.id);

      if (error) throw error;

      const rows = data ?? [];
      return {
        total: rows.length,
        draft: rows.filter((r) => r.status === "draft").length,
        in_review: rows.filter((r) => r.status === "in_review").length,
        approved: rows.filter((r) => r.status === "approved").length,
        filed: rows.filter((r) => r.status === "filed").length,
      };
    },
    enabled: !!user,
  });
}

// ── Create filing (with questionnaire snapshot) ──────────────

export function useCreateFiling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      client_user_id: string;
      filing_type: FilingType;
      tax_period_start: string;
      tax_period_end: string;
      questionnaire_snapshot?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("filing_records")
        .insert({
          accountant_client_id: input.accountant_client_id,
          accountant_id: user!.id,
          client_user_id: input.client_user_id,
          filing_type: input.filing_type,
          tax_period_start: input.tax_period_start,
          tax_period_end: input.tax_period_end,
          questionnaire_snapshot: input.questionnaire_snapshot ?? null,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["filing-records", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "counts"] });
    },
  });
}

// ── Update filing status / notes ─────────────────────────────

export function useUpdateFiling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      status?: FilingStatus;
      accountant_review_notes?: string;
      accountant_reviewed?: boolean;
      xml_file_url?: string;
      xml_generated_at?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.accountant_review_notes !== undefined) updates.accountant_review_notes = input.accountant_review_notes;
      if (input.accountant_reviewed !== undefined) updates.accountant_reviewed = input.accountant_reviewed;
      if (input.xml_file_url !== undefined) updates.xml_file_url = input.xml_file_url;
      if (input.xml_generated_at !== undefined) updates.xml_generated_at = input.xml_generated_at;

      const { data, error } = await supabase
        .from("filing_records")
        .update(updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["filing-records", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "counts"] });
    },
  });
}

// ── Approve filing ───────────────────────────────────────────

export function useApproveFiling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      review_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("filing_records")
        .update({
          status: "approved",
          accountant_reviewed: true,
          accountant_approved: true,
          accountant_review_notes: input.review_notes ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["filing-records", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "detail", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "counts"] });
    },
  });
}

// ── Delete filing ────────────────────────────────────────────

export function useDeleteFiling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accountant_client_id: string }) => {
      const { error } = await supabase
        .from("filing_records")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["filing-records", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["filing-records", "counts"] });
    },
  });
}
