import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ClientTask, TaskStatus, TaskPriority } from "@/types/accountant";

// ── Per-client task list ──────────────────────────────────────

export function useClientTasks(
  accountantClientId: string | null | undefined,
  filters?: { status?: TaskStatus | TaskStatus[] },
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-tasks", accountantClientId, filters],
    queryFn: async (): Promise<ClientTask[]> => {
      let query = supabase
        .from("client_tasks")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ClientTask[];
    },
    enabled: !!user && !!accountantClientId,
  });
}

// ── Cross-client task list (all tasks for the accountant) ────

interface CrossClientFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority;
}

export interface CrossClientTask extends ClientTask {
  client_name: string;
  client_business_name: string | null;
}

export function useAllAccountantTasks(filters?: CrossClientFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-all-tasks", user?.id, filters],
    queryFn: async (): Promise<CrossClientTask[]> => {
      let query = supabase
        .from("client_tasks")
        .select("*, accountant_client:accountant_clients(client_name, client_business_name)")
        .eq("accountant_id", user!.id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }
      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const client = r.accountant_client as { client_name: string; client_business_name: string | null } | null;
        return {
          ...r,
          client_name: client?.client_name ?? "Unknown",
          client_business_name: client?.client_business_name ?? null,
        } as CrossClientTask;
      });
    },
    enabled: !!user,
  });
}

// ── Task counts (for dashboard) ──────────────────────────────

export function useAccountantTaskCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["accountant-task-counts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_tasks")
        .select("status")
        .eq("accountant_id", user!.id);

      if (error) throw error;

      const rows = data ?? [];
      return {
        total: rows.length,
        todo: rows.filter((r) => r.status === "todo").length,
        in_progress: rows.filter((r) => r.status === "in_progress").length,
        done: rows.filter((r) => r.status === "done").length,
      };
    },
    enabled: !!user,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateTask() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountant_client_id: string;
      title: string;
      description?: string;
      priority?: TaskPriority;
      due_date?: string;
      category?: string;
    }) => {
      const { data, error } = await supabase
        .from("client_tasks")
        .insert({
          accountant_client_id: input.accountant_client_id,
          accountant_id: user!.id,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? "medium",
          due_date: input.due_date ?? null,
          category: input.category ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["accountant-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["accountant-task-counts"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      accountant_client_id: string;
      title?: string;
      description?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      due_date?: string | null;
      category?: string | null;
    }) => {
      const updates: Record<string, unknown> = {};
      if (input.title !== undefined) updates.title = input.title;
      if (input.description !== undefined) updates.description = input.description;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.due_date !== undefined) updates.due_date = input.due_date;
      if (input.category !== undefined) updates.category = input.category;

      if (input.status !== undefined) {
        updates.status = input.status;
        if (input.status === "done") {
          updates.completed_at = new Date().toISOString();
        } else {
          updates.completed_at = null;
        }
      }

      const { data, error } = await supabase
        .from("client_tasks")
        .update(updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["accountant-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["accountant-task-counts"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; accountant_client_id: string }) => {
      const { error } = await supabase
        .from("client_tasks")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-tasks", variables.accountant_client_id] });
      queryClient.invalidateQueries({ queryKey: ["accountant-all-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["accountant-task-counts"] });
    },
  });
}
