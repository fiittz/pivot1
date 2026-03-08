import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_type: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  business_profile: Record<string, unknown>;
  platform_fee_pct: number;
  created_at: string;
  updated_at: string;
}

export interface StripePayment {
  id: string;
  user_id: string;
  invoice_id: string | null;
  stripe_payment_intent_id: string;
  stripe_checkout_session_id: string | null;
  amount: number;
  currency: string;
  platform_fee: number;
  status: string;
  payment_method_type: string | null;
  customer_email: string | null;
  receipt_url: string | null;
  transaction_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Get the current user's Stripe account status */
export function useStripeAccount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stripe-account", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_accounts")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as StripeAccount | null;
    },
    enabled: !!user,
  });
}

/** Get a specific client's Stripe account (for accountant view) */
export function useClientStripeAccount(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["stripe-account", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_accounts")
        .select("*")
        .eq("user_id", clientUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as StripeAccount | null;
    },
    enabled: !!clientUserId,
  });
}

/** Start Stripe Connect onboarding */
export function useStripeOnboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      return data as { url: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["stripe-account"] });
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("Failed to start payment setup");
    },
  });
}

/** Create a Checkout session for an invoice */
export function useCreateCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { invoiceId, origin: window.location.origin },
      });
      if (error) throw error;
      return data as { url: string; sessionId: string };
    },
    onSuccess: (_data, invoiceId) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["stripe-payments", invoiceId] });
    },
    onError: () => {
      toast.error("Failed to create payment link");
    },
  });
}

/** Get payments for a specific invoice */
export function useInvoicePayments(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: ["stripe-payments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_payments")
        .select("*")
        .eq("invoice_id", invoiceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StripePayment[];
    },
    enabled: !!invoiceId,
  });
}

/** Get all payments for a client (accountant view) */
export function useClientPayments(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["stripe-payments-client", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stripe_payments")
        .select("*")
        .eq("user_id", clientUserId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as StripePayment[];
    },
    enabled: !!clientUserId,
  });
}
