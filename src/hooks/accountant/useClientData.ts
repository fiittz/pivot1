/**
 * Read-only data hooks for accountant viewing a client's data.
 * These mirror the existing owner hooks but are parameterized by clientUserId
 * instead of using auth.uid(). The is_accountant_for() RLS function
 * grants SELECT access on the client's tables.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ────────────────────────────────────────────
// Transactions
// ────────────────────────────────────────────
export function useClientTransactions(
  clientUserId: string | null | undefined,
  filters?: {
    type?: "income" | "expense";
    startDate?: string;
    endDate?: string;
    limit?: number;
    accountType?: string;
  },
) {
  return useQuery({
    queryKey: ["client-transactions", clientUserId, filters],
    queryFn: async () => {
      let query = supabase
        .from("transactions")
        .select(`*, category:categories(id, name)`)
        .eq("user_id", clientUserId!)
        .order("transaction_date", { ascending: false });

      if (filters?.type) query = query.eq("type", filters.type);
      if (filters?.startDate) query = query.gte("transaction_date", filters.startDate);
      if (filters?.endDate) query = query.lte("transaction_date", filters.endDate);
      if (filters?.limit) query = query.limit(filters.limit);

      if (filters?.accountType) {
        const { data: accts } = await supabase
          .from("accounts")
          .select("id")
          .eq("user_id", clientUserId!)
          .eq("account_type", filters.accountType);
        const ids = (accts ?? []).map((a) => a.id);
        if (ids.length === 0) return [];
        query = query.in("account_id", ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Invoices
// ────────────────────────────────────────────
export function useClientInvoices(
  clientUserId: string | null | undefined,
  options?: { limit?: number; status?: string },
) {
  return useQuery({
    queryKey: ["client-invoices", clientUserId, options],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select(`*, customer:customers(id, name, email, phone, address, vat_number)`)
        .eq("user_id", clientUserId!)
        .order("invoice_date", { ascending: false });

      if (options?.status) query = query.eq("status", options.status);
      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Expenses
// ────────────────────────────────────────────
export function useClientExpenses(
  clientUserId: string | null | undefined,
  options?: { limit?: number },
) {
  return useQuery({
    queryKey: ["client-expenses", clientUserId, options],
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select(`*, category:categories(id, name), supplier:suppliers(id, name)`)
        .eq("user_id", clientUserId!)
        .order("expense_date", { ascending: false });

      if (options?.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Categories
// ────────────────────────────────────────────
export function useClientCategories(
  clientUserId: string | null | undefined,
  type?: "income" | "expense",
  accountType?: string,
) {
  return useQuery({
    queryKey: ["client-categories", clientUserId, type, accountType],
    queryFn: async () => {
      let query = supabase
        .from("categories")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("name");

      if (type) query = query.eq("type", type);
      if (accountType === "limited_company") {
        query = query.in("account_type", ["business", "both"]);
      } else if (accountType === "directors_personal_tax") {
        query = query.in("account_type", ["personal", "both"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Accounts
// ────────────────────────────────────────────
export function useClientAccounts(
  clientUserId: string | null | undefined,
  typeFilter?: string,
) {
  return useQuery({
    queryKey: ["client-accounts", clientUserId, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("accounts")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("account_type")
        .order("name");

      if (typeFilter) query = query.eq("account_type", typeFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Receipts
// ────────────────────────────────────────────
export function useClientReceipts(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-receipts", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Onboarding Settings (for report metadata)
// ────────────────────────────────────────────
export function useClientOnboardingSettings(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-onboarding", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("*")
        .eq("user_id", clientUserId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Director Onboarding (for Form 11 data)
// ────────────────────────────────────────────
export function useClientDirectorOnboarding(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-director-onboarding", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("director_onboarding")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("director_number");

      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Client Profile (business name, etc.)
// ────────────────────────────────────────────
export function useClientProfile(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-profile", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", clientUserId!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// VAT Returns
// ────────────────────────────────────────────
export function useClientVATReturns(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-vat-returns", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vat_returns")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("period_start", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientUserId,
  });
}
