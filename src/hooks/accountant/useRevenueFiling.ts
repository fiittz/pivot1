import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReturnType = "VAT3" | "CT1" | "Form11";
export type FilingStatus = "draft" | "submitting" | "filed" | "pending" | "rejected" | "failed";

export interface RevenueFiling {
  id: string;
  accountant_id: string;
  client_user_id: string;
  return_type: ReturnType;
  tax_year: number;
  period_start: string;
  period_end: string;
  status: FilingStatus;
  filing_reference: string | null;
  revenue_status: string | null;
  error_message: string | null;
  summary_data: Record<string, unknown> | null;
  test_mode: boolean;
  submitted_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all filings for a client, sorted by most recent.
 */
export function useClientFilings(
  clientUserId: string | null | undefined,
  taxYear?: number,
) {
  return useQuery({
    queryKey: ["revenue-filings", clientUserId, taxYear],
    queryFn: async (): Promise<RevenueFiling[]> => {
      let query = supabase
        .from("revenue_filings")
        .select("*")
        .eq("client_user_id", clientUserId!)
        .order("created_at", { ascending: false });

      if (taxYear) {
        query = query.eq("tax_year", taxYear);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as RevenueFiling[];
    },
    enabled: !!clientUserId,
    staleTime: 60 * 1000,
  });
}

/**
 * Check if a specific return type has already been filed for a period.
 */
export function useFilingExists(
  clientUserId: string | null | undefined,
  returnType: ReturnType,
  periodStart: string,
  periodEnd: string,
) {
  return useQuery({
    queryKey: ["filing-exists", clientUserId, returnType, periodStart, periodEnd],
    queryFn: async (): Promise<RevenueFiling | null> => {
      const { data, error } = await supabase
        .from("revenue_filings")
        .select("*")
        .eq("client_user_id", clientUserId!)
        .eq("return_type", returnType)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .in("status", ["filed", "pending", "submitting"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as RevenueFiling | null;
    },
    enabled: !!clientUserId,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * File a return to Revenue via the edge function.
 * Generates the XML on the client side, sends it to the edge function,
 * which wraps it in SOAP and submits to Revenue ROS.
 */
export function useFileReturn() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clientUserId: string;
      returnType: ReturnType;
      periodStart: string;
      periodEnd: string;
      taxYear: number;
      returnXml: string;
      summary?: Record<string, unknown>;
    }) => {
      const actionMap: Record<ReturnType, string> = {
        VAT3: "file_vat3",
        CT1: "file_ct1",
        Form11: "file_form11",
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-ros-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: actionMap[input.returnType],
            clientUserId: input.clientUserId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            taxYear: input.taxYear,
            returnXml: input.returnXml,
            summary: input.summary,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Filing failed with status ${response.status}`);
      }

      return result as {
        filingId: string;
        returnType: string;
        filingReference: string | null;
        status: string;
        testMode: boolean;
      };
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["revenue-filings", variables.clientUserId] });
      qc.invalidateQueries({ queryKey: ["filing-exists", variables.clientUserId] });

      if (data.testMode) {
        toast.success(`${variables.returnType} submitted (TEST MODE)`, {
          description: `Reference: ${data.filingReference || "pending"}`,
        });
      } else {
        toast.success(`${variables.returnType} filed with Revenue`, {
          description: `Reference: ${data.filingReference || "pending acknowledgement"}`,
        });
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to file return",
      );
    },
  });
}

/**
 * Check the status of a filed return with Revenue.
 */
export function useCheckFilingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { filingId: string; clientUserId: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revenue-ros-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "check_status",
            filingId: input.filingId,
            clientUserId: input.clientUserId,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Status check failed");
      }

      return result as {
        filingId: string;
        filingReference: string;
        status: string;
        message: string | null;
      };
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["revenue-filings", variables.clientUserId] });
      toast.info(`Filing status: ${data.status}`);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to check status",
      );
    },
  });
}

/**
 * Save a draft filing (XML generated but not yet submitted to Revenue).
 */
export function useSaveDraftFiling() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clientUserId: string;
      returnType: ReturnType;
      periodStart: string;
      periodEnd: string;
      taxYear: number;
      returnXml: string;
      summary?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("revenue_filings")
        .upsert(
          {
            accountant_id: user!.id,
            client_user_id: input.clientUserId,
            return_type: input.returnType,
            tax_year: input.taxYear,
            period_start: input.periodStart,
            period_end: input.periodEnd,
            status: "draft",
            return_xml: input.returnXml,
            summary_data: input.summary || null,
            test_mode: true,
          },
          { onConflict: "client_user_id,return_type,period_start,period_end" },
        )
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["revenue-filings", variables.clientUserId] });
      toast.success(`${variables.returnType} draft saved`);
    },
    onError: () => {
      toast.error("Failed to save draft");
    },
  });
}
