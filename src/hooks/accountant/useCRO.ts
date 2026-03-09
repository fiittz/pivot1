import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { CROCompany, CROFiling, CROAnnualAccounts, CROSearchResult } from "@/types/cro";

// ---------------------------------------------------------------------------
// 1. Search CRO (via edge function)
// ---------------------------------------------------------------------------
export function useCROSearch() {
  return useMutation({
    mutationFn: async (params: { company_name?: string; company_num?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cro-api`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "search_companies", ...params }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as CROSearchResult[];
    },
  });
}

// ---------------------------------------------------------------------------
// 2. Fetch CRO company by client user_id
// ---------------------------------------------------------------------------
export function useCROCompany(clientUserId?: string) {
  return useQuery({
    queryKey: ["cro-company", clientUserId],
    queryFn: async (): Promise<CROCompany | null> => {
      const { data, error } = await supabase
        .from("cro_companies")
        .select("*")
        .eq("user_id", clientUserId!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CROCompany | null;
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// 3. Fetch CRO company by company_num
// ---------------------------------------------------------------------------
export function useCROCompanyByNum(companyNum?: string) {
  return useQuery({
    queryKey: ["cro-company-by-num", companyNum],
    queryFn: async (): Promise<CROCompany | null> => {
      const { data, error } = await supabase
        .from("cro_companies")
        .select("*")
        .eq("company_num", companyNum!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CROCompany | null;
    },
    enabled: !!companyNum,
  });
}

// ---------------------------------------------------------------------------
// 4. Sync CRO company (via edge function)
// ---------------------------------------------------------------------------
export function useSyncCROCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { company_num: string; user_id?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cro-api`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "sync_company", ...params }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cro-company"] });
      queryClient.invalidateQueries({ queryKey: ["cro-company-by-num", variables.company_num] });
      queryClient.invalidateQueries({ queryKey: ["cro-filings"] });
      queryClient.invalidateQueries({ queryKey: ["cro-deadlines"] });
    },
  });
}

// ---------------------------------------------------------------------------
// 5. Fetch CRO filings for a company
// ---------------------------------------------------------------------------
export function useCROFilings(croCompanyId?: string) {
  return useQuery({
    queryKey: ["cro-filings", croCompanyId],
    queryFn: async (): Promise<CROFiling[]> => {
      const { data, error } = await supabase
        .from("cro_filings")
        .select("*")
        .eq("cro_company_id", croCompanyId!)
        .order("sub_received_date", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CROFiling[];
    },
    enabled: !!croCompanyId,
  });
}

// ---------------------------------------------------------------------------
// 6. Fetch CRO annual accounts for a company
// ---------------------------------------------------------------------------
export function useCROAnnualAccounts(croCompanyId?: string) {
  return useQuery({
    queryKey: ["cro-annual-accounts", croCompanyId],
    queryFn: async (): Promise<CROAnnualAccounts[]> => {
      const { data, error } = await supabase
        .from("cro_annual_accounts")
        .select("*")
        .eq("cro_company_id", croCompanyId!)
        .order("financial_year_end", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CROAnnualAccounts[];
    },
    enabled: !!croCompanyId,
  });
}

// ---------------------------------------------------------------------------
// 7. Fetch a single year's annual accounts
// ---------------------------------------------------------------------------
export function useCROAnnualAccountsForYear(croCompanyId?: string, yearEnd?: string) {
  return useQuery({
    queryKey: ["cro-annual-accounts", croCompanyId, yearEnd],
    queryFn: async (): Promise<CROAnnualAccounts | null> => {
      const { data, error } = await supabase
        .from("cro_annual_accounts")
        .select("*")
        .eq("cro_company_id", croCompanyId!)
        .eq("financial_year_end", yearEnd!)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CROAnnualAccounts | null;
    },
    enabled: !!croCompanyId && !!yearEnd,
  });
}

// ---------------------------------------------------------------------------
// 8. Upsert CRO annual accounts
// ---------------------------------------------------------------------------
export function useSaveCROAnnualAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Partial<CROAnnualAccounts> & {
        cro_company_id: string;
        financial_year_end: string;
      },
    ) => {
      const { data, error } = await supabase
        .from("cro_annual_accounts")
        .upsert(input as never, {
          onConflict: "cro_company_id,financial_year_end",
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CROAnnualAccounts;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cro-annual-accounts", variables.cro_company_id],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 9. Extract accounts from PDF (via edge function)
// ---------------------------------------------------------------------------
export function useExtractAccountsPDF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      cro_company_id: string;
      financial_year_end: string;
      pdf_base64: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cro-api`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "extract_accounts_pdf", ...params }),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cro-annual-accounts", variables.cro_company_id],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 10. CRO deadlines for dashboard (all accountant's clients)
// ---------------------------------------------------------------------------
export function useCRODeadlines() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cro-deadlines", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all client user_ids for this accountant
      const { data: clients, error: clientError } = await supabase
        .from("accountant_clients")
        .select("client_user_id")
        .eq("accountant_id", user.id)
        .eq("status", "active");

      if (clientError) throw clientError;

      const clientUserIds = (clients || [])
        .map((c) => c.client_user_id)
        .filter(Boolean) as string[];

      if (clientUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from("cro_companies")
        .select("company_name, company_num, next_ar_date")
        .in("user_id", clientUserIds);

      if (error) throw error;

      return (data || []) as Array<{
        company_name: string;
        company_num: string;
        next_ar_date: string | null;
      }>;
    },
    enabled: !!user,
  });
}
