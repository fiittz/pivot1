import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RCTContract {
  id: string;
  user_id: string;
  principal_name: string;
  principal_tax_ref: string;
  subcontractor_id: string;
  contract_ref: string;
  contract_description: string;
  start_date: string;
  end_date: string | null;
  estimated_value: number;
  status: "active" | "completed" | "cancelled";
  revenue_notified: boolean;
  revenue_notification_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RCTPaymentNotification {
  id: string;
  contract_id: string;
  invoice_id: string | null;
  subcontractor_id: string;
  gross_amount: number;
  rct_rate: number;
  rct_amount: number;
  net_payable: number;
  deduction_ref: string | null;
  status: "pending" | "authorised" | "rejected" | "paid";
  requested_at: string;
  authorised_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RCTRateLookup {
  subcontractor_tax_ref: string;
  subcontractor_name: string;
  rate: number;
  rate_label: string;
  valid_from: string;
  valid_to: string;
}

export interface RevenueCredentials {
  id: string;
  accountant_id: string;
  tain: string;
  agent_name: string;
  ros_cert_serial: string | null;
  tax_registration_number: string;
  is_active: boolean;
  test_mode: boolean;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientRevenueLink {
  employer_reg_number: string | null;
  tax_reg_number: string | null;
  rct_principal_number: string | null;
  revenue_linked: boolean;
  revenue_link_verified_at: string | null;
}

export interface Subcontractor {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  ppsn_or_tax_ref: string;
  company_reg_number: string | null;
  verified_with_revenue: boolean;
  last_rate_check: string | null;
  revenue_rate: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Edge function helper
// ---------------------------------------------------------------------------

async function callRevenueEdgeFunction(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-erct`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ action, ...params }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Edge function returned ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// 1. useRCTContracts
// ---------------------------------------------------------------------------

export function useRCTContracts(userId: string | undefined) {
  return useQuery<RCTContract[]>({
    queryKey: ["rct-contracts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rct_contracts")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RCTContract[];
    },
    enabled: !!userId,
  });
}

// ---------------------------------------------------------------------------
// 2. useCreateRCTContract
// ---------------------------------------------------------------------------

export function useCreateRCTContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contract: Omit<RCTContract, "id" | "created_at" | "updated_at" | "revenue_notified" | "revenue_notification_date">) => {
      // Insert the contract locally
      const { data, error } = await supabase
        .from("rct_contracts")
        .insert(contract)
        .select()
        .single();

      if (error) throw error;

      // Notify Revenue via edge function
      try {
        await callRevenueEdgeFunction("notify_contract", {
          contract_id: data.id,
          contract_ref: data.contract_ref,
          principal_tax_ref: contract.principal_tax_ref,
          subcontractor_id: contract.subcontractor_id,
        });

        // Mark as notified
        await supabase
          .from("rct_contracts")
          .update({
            revenue_notified: true,
            revenue_notification_date: new Date().toISOString(),
          })
          .eq("id", data.id);
      } catch {
        toast.error("Contract saved but Revenue notification failed. You can retry later.");
      }

      return data as RCTContract;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rct-contracts", variables.user_id] });
      toast.success("RCT contract created successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create contract: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 3. useSubcontractors
// ---------------------------------------------------------------------------

export function useSubcontractors(userId: string | undefined) {
  return useQuery<Subcontractor[]>({
    queryKey: ["subcontractors", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontractors")
        .select("*")
        .eq("user_id", userId!)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Subcontractor[];
    },
    enabled: !!userId,
  });
}

// ---------------------------------------------------------------------------
// 4. useCreateSubcontractor
// ---------------------------------------------------------------------------

export function useCreateSubcontractor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subcontractor: Omit<Subcontractor, "id" | "created_at" | "updated_at" | "verified_with_revenue" | "last_rate_check" | "revenue_rate">) => {
      const { data, error } = await supabase
        .from("subcontractors")
        .insert({
          ...subcontractor,
          verified_with_revenue: false,
          last_rate_check: null,
          revenue_rate: null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Subcontractor;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors", variables.user_id] });
      toast.success("Subcontractor added successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to add subcontractor: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 5. useRCTRateLookup
// ---------------------------------------------------------------------------

export function useRCTRateLookup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { subcontractor_id: string; subcontractor_tax_ref: string; contract_id: string }) => {
      const result = await callRevenueEdgeFunction("rate_lookup", params);

      // Update the subcontractor record with the returned rate
      if (result?.rate !== undefined) {
        await supabase
          .from("subcontractors")
          .update({
            revenue_rate: result.rate,
            last_rate_check: new Date().toISOString(),
            verified_with_revenue: true,
          })
          .eq("id", params.subcontractor_id);
      }

      return result as RCTRateLookup;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
      queryClient.invalidateQueries({ queryKey: ["rct-rate-lookup", variables.subcontractor_id] });
      toast.success("Rate lookup completed successfully");
    },
    onError: (error: Error) => {
      toast.error(`Rate lookup failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 6. useRCTPaymentNotifications
// ---------------------------------------------------------------------------

export function useRCTPaymentNotifications(contractId?: string) {
  return useQuery<RCTPaymentNotification[]>({
    queryKey: ["rct-payment-notifications", contractId],
    queryFn: async () => {
      let query = supabase
        .from("rct_payment_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (contractId) {
        query = query.eq("contract_id", contractId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as RCTPaymentNotification[];
    },
  });
}

// ---------------------------------------------------------------------------
// 7. useRequestDeductionAuth
// ---------------------------------------------------------------------------

export function useRequestDeductionAuth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      contract_id: string;
      invoice_id: string;
      subcontractor_id: string;
      gross_amount: number;
    }) => {
      const result = await callRevenueEdgeFunction("request_deduction_auth", params);

      // Insert the payment notification record
      const { data, error } = await supabase
        .from("rct_payment_notifications")
        .insert({
          contract_id: params.contract_id,
          invoice_id: params.invoice_id,
          subcontractor_id: params.subcontractor_id,
          gross_amount: params.gross_amount,
          rct_rate: result.rate,
          rct_amount: result.rct_amount,
          net_payable: result.net_payable,
          deduction_ref: result.deduction_ref,
          status: result.status ?? "authorised",
          requested_at: new Date().toISOString(),
          authorised_at: result.status === "authorised" ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as RCTPaymentNotification;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rct-payment-notifications", variables.contract_id] });
      queryClient.invalidateQueries({ queryKey: ["rct-payment-notifications"] });
      toast.success("Deduction authorisation received");
    },
    onError: (error: Error) => {
      toast.error(`Deduction authorisation failed: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 8. useRCTMonthlySummary
// ---------------------------------------------------------------------------

export interface RCTMonthlySummary {
  month: number;
  year: number;
  total_gross: number;
  total_rct_deducted: number;
  total_net_paid: number;
  notification_count: number;
  notifications: RCTPaymentNotification[];
}

export function useRCTMonthlySummary(userId: string | undefined, month: number, year: number) {
  return useQuery<RCTMonthlySummary>({
    queryKey: ["rct-monthly-summary", userId, month, year],
    queryFn: async () => {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("rct_payment_notifications")
        .select("*, rct_contracts!inner(user_id)")
        .eq("rct_contracts.user_id", userId!)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const notifications = (data ?? []) as RCTPaymentNotification[];

      const totalGross = notifications.reduce((sum, n) => sum + n.gross_amount, 0);
      const totalRCT = notifications.reduce((sum, n) => sum + n.rct_amount, 0);
      const totalNet = notifications.reduce((sum, n) => sum + n.net_payable, 0);

      return {
        month,
        year,
        total_gross: Math.round(totalGross * 100) / 100,
        total_rct_deducted: Math.round(totalRCT * 100) / 100,
        total_net_paid: Math.round(totalNet * 100) / 100,
        notification_count: notifications.length,
        notifications,
      };
    },
    enabled: !!userId && month >= 1 && month <= 12 && year > 0,
  });
}

// ---------------------------------------------------------------------------
// 9. useAgentCredentials — fetch the accountant's own credentials
// ---------------------------------------------------------------------------

export function useAgentCredentials() {
  const { user } = useAuth();
  return useQuery<RevenueCredentials | null>({
    queryKey: ["agent-credentials", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountant_revenue_credentials")
        .select("*")
        .eq("accountant_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as RevenueCredentials | null;
    },
    enabled: !!user?.id,
  });
}

// ---------------------------------------------------------------------------
// 10. useSaveAgentCredentials
// ---------------------------------------------------------------------------

// Alias exports for component compatibility
export { useSubcontractors as useRCTSubcontractors };
export { useCreateSubcontractor as useAddRCTSubcontractor };
export { useRCTMonthlySummary as useRCTMonthlyReturn };
export { useAgentCredentials as useRCTRevenueSetup };
export { useSaveAgentCredentials as useSaveRCTRevenueSetup };
export type RCTSubcontractor = Subcontractor;
export type RCTMonthlyReturn = RCTMonthlySummary;
export type RCTRevenueSetup = RevenueCredentials;

// ---------------------------------------------------------------------------
// useSubmitRCTReturn - Submit monthly RCT return to Revenue
// ---------------------------------------------------------------------------

export function useSubmitRCTReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { month: number; year: number }) => {
      return callRevenueEdgeFunction("submit_return", params);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["rct-monthly-summary"] });
      queryClient.invalidateQueries({ queryKey: ["rct-payment-notifications"] });
      toast.success(`RCT return for ${variables.month}/${variables.year} submitted`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit return: ${error.message}`);
    },
  });
}

export function useSaveAgentCredentials() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (credentials: {
      tain: string;
      agent_name: string;
      ros_cert_serial?: string;
      tax_registration_number: string;
      is_active?: boolean;
      test_mode?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("accountant_revenue_credentials")
        .upsert(
          {
            accountant_id: user!.id,
            tain: credentials.tain,
            agent_name: credentials.agent_name,
            ros_cert_serial: credentials.ros_cert_serial || null,
            tax_registration_number: credentials.tax_registration_number,
            is_active: credentials.is_active ?? true,
            test_mode: credentials.test_mode ?? true,
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "accountant_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as RevenueCredentials;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-credentials", user?.id] });
      toast.success("Agent credentials saved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save credentials: ${error.message}`);
    },
  });
}

// ---------------------------------------------------------------------------
// 11. useClientRevenueLink — fetch a client's Revenue linkage fields
// ---------------------------------------------------------------------------

export function useClientRevenueLink(accountantClientId: string | undefined) {
  return useQuery<ClientRevenueLink | null>({
    queryKey: ["client-revenue-link", accountantClientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountant_clients")
        .select("employer_reg_number, tax_reg_number, rct_principal_number, revenue_linked, revenue_link_verified_at")
        .eq("id", accountantClientId!)
        .single();

      if (error) throw error;
      return data as ClientRevenueLink | null;
    },
    enabled: !!accountantClientId,
  });
}

// ---------------------------------------------------------------------------
// 12. useSaveClientRevenueLink — update a client's Revenue linkage fields
// ---------------------------------------------------------------------------

export function useSaveClientRevenueLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      accountantClientId: string;
      employer_reg_number?: string;
      tax_reg_number?: string;
      rct_principal_number?: string;
    }) => {
      const { data, error } = await supabase
        .from("accountant_clients")
        .update({
          employer_reg_number: params.employer_reg_number || null,
          tax_reg_number: params.tax_reg_number || null,
          rct_principal_number: params.rct_principal_number || null,
          revenue_linked: true,
          revenue_link_verified_at: new Date().toISOString(),
        })
        .eq("id", params.accountantClientId)
        .select("employer_reg_number, tax_reg_number, rct_principal_number, revenue_linked, revenue_link_verified_at")
        .single();

      if (error) throw error;
      return data as ClientRevenueLink;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["client-revenue-link", variables.accountantClientId] });
      toast.success("Client Revenue link saved successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save client Revenue link: ${error.message}`);
    },
  });
}
