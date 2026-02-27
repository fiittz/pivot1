import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type DocumentRequestStatus = "pending" | "uploaded" | "accepted" | "rejected";

export interface DocumentRequest {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  client_user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: DocumentRequestStatus;
  due_date: string | null;
  uploaded_file_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ── Accountant: list requests for a specific client ──────────

export function useDocumentRequestsByClient(accountantClientId: string | null | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["document-requests", "by-client", accountantClientId],
    queryFn: async (): Promise<DocumentRequest[]> => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DocumentRequest[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

// ── Accountant: cross-client pending request count ───────────

export function useDocumentRequestCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["document-requests", "counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("status")
        .eq("accountant_id", user!.id);

      if (error) throw error;

      const rows = data ?? [];
      return {
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        uploaded: rows.filter((r) => r.status === "uploaded").length,
        accepted: rows.filter((r) => r.status === "accepted").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
      };
    },
    enabled: !!user,
  });
}

// ── Client: list own pending document requests ───────────────

export function useMyDocumentRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-document-requests", user?.id],
    queryFn: async (): Promise<(DocumentRequest & { practice_name?: string })[]> => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, accountant_client:accountant_clients(practice:accountant_practices(name))")
        .eq("client_user_id", user!.id)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as Record<string, unknown> | null;
        const practice = client?.practice as { name: string } | null;
        return {
          ...r,
          practice_name: practice?.name ?? undefined,
        } as DocumentRequest & { practice_name?: string };
      });
    },
    enabled: !!user,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateDocumentRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      client_user_id: string;
      title: string;
      description?: string;
      category?: string;
      due_date?: string;
    }) => {
      const { data, error } = await supabase
        .from("document_requests")
        .insert({
          accountant_client_id: input.accountant_client_id,
          accountant_id: user!.id,
          client_user_id: input.client_user_id,
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? null,
          due_date: input.due_date ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-requests", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["document-requests", "counts"] });
    },
  });
}

export function useUpdateDocumentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      status?: DocumentRequestStatus;
      rejection_reason?: string;
      uploaded_file_url?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (input.status !== undefined) updates.status = input.status;
      if (input.rejection_reason !== undefined) updates.rejection_reason = input.rejection_reason;
      if (input.uploaded_file_url !== undefined) updates.uploaded_file_url = input.uploaded_file_url;

      const { data, error } = await supabase
        .from("document_requests")
        .update(updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-requests", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["document-requests", "counts"] });
      queryClient.invalidateQueries({ queryKey: ["my-document-requests"] });
    },
  });
}

export function useDeleteDocumentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accountant_client_id: string }) => {
      const { error } = await supabase
        .from("document_requests")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["document-requests", "by-client", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["document-requests", "counts"] });
    },
  });
}
