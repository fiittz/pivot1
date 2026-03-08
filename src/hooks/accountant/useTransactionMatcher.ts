import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  matchTransactions,
  normalizeDescription,
  type BankTransaction,
  type Invoice,
  type PayrollLine,
  type VendorRule,
  type MatchResult,
  type MatchContext,
} from "@/lib/matching/transactionMatcher";

// ────────────────────────────────────────────
// Vendor Rules Hook
// ────────────────────────────────────────────

export function useVendorRules(clientUserId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-rules", clientUserId],
    queryFn: async (): Promise<VendorRule[]> => {
      const { data, error } = await supabase
        .from("vendor_rules")
        .select("vendor_pattern, category_id, category_name, avg_amount, confirmation_count")
        .eq("user_id", clientUserId!);

      if (error) throw error;
      return (data ?? []) as unknown as VendorRule[];
    },
    enabled: !!clientUserId,
    staleTime: 5 * 60 * 1000,
  });
}

// ────────────────────────────────────────────
// Transaction Matcher Hook
// ────────────────────────────────────────────

export function useTransactionMatcher(
  clientUserId: string | undefined,
  accountIds?: string[],
) {
  // 1. Fetch unmatched transactions
  const unmatchedQuery = useQuery({
    queryKey: ["unmatched-transactions", clientUserId, accountIds],
    queryFn: async (): Promise<BankTransaction[]> => {
      let query = supabase
        .from("bank_transactions")
        .select("id, account_id, user_id, transaction_date, description, reference, amount")
        .eq("user_id", clientUserId!)
        .eq("is_matched", false)
        .order("transaction_date", { ascending: false });

      if (accountIds && accountIds.length > 0) {
        query = query.in("account_id", accountIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BankTransaction[];
    },
    enabled: !!clientUserId,
    staleTime: 60 * 1000,
  });

  // 2. Fetch all recent transactions (for transfer detection & historical patterns)
  const allTransactionsQuery = useQuery({
    queryKey: ["all-recent-transactions", clientUserId],
    queryFn: async (): Promise<BankTransaction[]> => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("id, account_id, user_id, transaction_date, description, reference, amount")
        .eq("user_id", clientUserId!)
        .order("transaction_date", { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data ?? []) as unknown as BankTransaction[];
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });

  // 3. Fetch open invoices
  const invoicesQuery = useQuery({
    queryKey: ["open-invoices", clientUserId],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer_name, total_amount, due_date, invoice_date, status, payment_method")
        .eq("user_id", clientUserId!)
        .in("status", ["sent", "overdue", "outstanding"]);

      if (error) throw error;
      return (data ?? []) as unknown as Invoice[];
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });

  // 4. Fetch known payroll lines (most recent run)
  const payrollQuery = useQuery({
    queryKey: ["recent-payroll-lines", clientUserId],
    queryFn: async (): Promise<PayrollLine[]> => {
      // Get the most recent payroll run
      const { data: runs, error: runError } = await supabase
        .from("payroll_runs")
        .select("id")
        .eq("user_id", clientUserId!)
        .order("pay_date", { ascending: false })
        .limit(3);

      if (runError) throw runError;
      if (!runs || runs.length === 0) return [];

      const runIds = runs.map((r: { id: string }) => r.id);

      const { data: lines, error: linesError } = await supabase
        .from("payroll_lines")
        .select("net_pay, employer_prsi, total_deductions, payroll_run_id")
        .in("payroll_run_id", runIds);

      if (linesError) throw linesError;
      if (!lines) return [];

      // Get employee names
      const employeeIds = [...new Set((lines as { employee_id?: string }[]).map((l) => (l as { employee_id: string }).employee_id).filter(Boolean))];
      let empMap = new Map<string, string>();

      if (employeeIds.length > 0) {
        const { data: emps } = await supabase
          .from("employees")
          .select("id, first_name, last_name")
          .in("id", employeeIds);

        if (emps) {
          for (const emp of emps as { id: string; first_name: string; last_name: string }[]) {
            empMap.set(emp.id, `${emp.first_name} ${emp.last_name}`);
          }
        }
      }

      // Get pay_date from runs
      const { data: runDates } = await supabase
        .from("payroll_runs")
        .select("id, pay_date")
        .in("id", runIds);

      const dateMap = new Map<string, string>();
      if (runDates) {
        for (const r of runDates as { id: string; pay_date: string }[]) {
          dateMap.set(r.id, r.pay_date);
        }
      }

      return (lines as unknown as (PayrollLine & { employee_id: string; payroll_run_id: string })[]).map((l) => ({
        employee_name: empMap.get(l.employee_id) ?? "Unknown",
        net_pay: Number(l.net_pay),
        employer_prsi: Number(l.employer_prsi),
        total_deductions: Number(l.total_deductions),
        pay_date: dateMap.get(l.payroll_run_id) ?? "",
      }));
    },
    enabled: !!clientUserId,
    staleTime: 5 * 60 * 1000,
  });

  // 5. Fetch vendor rules
  const vendorRulesQuery = useVendorRules(clientUserId);

  // 6. Run matching engine
  const matchResults = useQuery({
    queryKey: [
      "match-results",
      clientUserId,
      unmatchedQuery.data?.length,
      allTransactionsQuery.data?.length,
      invoicesQuery.data?.length,
      payrollQuery.data?.length,
      vendorRulesQuery.data?.length,
    ],
    queryFn: (): MatchResult[] => {
      const unmatched = unmatchedQuery.data ?? [];
      if (unmatched.length === 0) return [];

      const context: MatchContext = {
        otherTransactions: allTransactionsQuery.data ?? [],
        openInvoices: invoicesQuery.data ?? [],
        knownPayrollLines: payrollQuery.data ?? [],
        historicalTransactions: allTransactionsQuery.data ?? [],
        vendorRules: vendorRulesQuery.data ?? [],
      };

      return matchTransactions(unmatched, context);
    },
    enabled:
      !!clientUserId &&
      !!unmatchedQuery.data &&
      !!allTransactionsQuery.data &&
      !unmatchedQuery.isLoading &&
      !allTransactionsQuery.isLoading,
    staleTime: 60 * 1000,
  });

  return {
    matchResults: matchResults.data ?? [],
    isLoading:
      unmatchedQuery.isLoading ||
      allTransactionsQuery.isLoading ||
      invoicesQuery.isLoading ||
      payrollQuery.isLoading ||
      vendorRulesQuery.isLoading ||
      matchResults.isLoading,
    isError:
      unmatchedQuery.isError ||
      allTransactionsQuery.isError ||
      matchResults.isError,
    error: unmatchedQuery.error || allTransactionsQuery.error || matchResults.error,
    unmatchedCount: unmatchedQuery.data?.length ?? 0,
    refetch: () => {
      unmatchedQuery.refetch();
      allTransactionsQuery.refetch();
      invoicesQuery.refetch();
      payrollQuery.refetch();
      vendorRulesQuery.refetch();
    },
  };
}

// ────────────────────────────────────────────
// Accept Match Mutation
// ────────────────────────────────────────────

export function useAcceptMatch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      transaction_id: string;
      match_type: MatchResult["match_type"];
      category_id?: string;
      category_name?: string;
      matched_invoice_id?: string;
      matched_transfer_id?: string;
      user_id: string;
      description: string;
    }) => {
      // 1. Mark transaction as matched
      const { error: txnError } = await supabase
        .from("bank_transactions")
        .update({
          is_matched: true,
          match_type: input.match_type,
          category_id: input.category_id ?? null,
          category_name: input.category_name ?? null,
          matched_invoice_id: input.matched_invoice_id ?? null,
          matched_transfer_id: input.matched_transfer_id ?? null,
          matched_at: new Date().toISOString(),
        })
        .eq("id", input.transaction_id);

      if (txnError) throw txnError;

      // 2. If invoice match, update invoice status
      if (input.match_type === "invoice" && input.matched_invoice_id) {
        const { error: invError } = await supabase
          .from("invoices")
          .update({ status: "paid" })
          .eq("id", input.matched_invoice_id);

        if (invError) throw invError;
      }

      // 3. If vendor rule match, increment confirmation count (or create new rule)
      if (input.match_type === "vendor_rule" && input.category_id) {
        const normalized = normalizeDescription(input.description);
        const { data: existing } = await supabase
          .from("vendor_rules")
          .select("id, confirmation_count, avg_amount")
          .eq("user_id", input.user_id)
          .eq("vendor_pattern", normalized)
          .maybeSingle();

        if (existing) {
          const typedExisting = existing as unknown as { id: string; confirmation_count: number };
          await supabase
            .from("vendor_rules")
            .update({
              confirmation_count: typedExisting.confirmation_count + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", typedExisting.id);
        }
      }

      // 4. If manually categorised and no vendor rule exists yet, create one
      if (input.match_type === "uncategorised" && input.category_id) {
        const normalized = normalizeDescription(input.description);
        const { data: existing } = await supabase
          .from("vendor_rules")
          .select("id")
          .eq("user_id", input.user_id)
          .eq("vendor_pattern", normalized)
          .maybeSingle();

        if (!existing) {
          // Fetch the amount for avg_amount
          const { data: txnData } = await supabase
            .from("bank_transactions")
            .select("amount")
            .eq("id", input.transaction_id)
            .single();

          const amount = txnData ? Math.abs((txnData as unknown as { amount: number }).amount) : 0;

          await supabase.from("vendor_rules").insert({
            user_id: input.user_id,
            vendor_pattern: normalized,
            category_id: input.category_id,
            category_name: input.category_name ?? "",
            avg_amount: amount,
            confirmation_count: 1,
          });
        } else {
          // Increment existing
          const typedExisting = existing as unknown as { id: string };
          const { data: rule } = await supabase
            .from("vendor_rules")
            .select("confirmation_count")
            .eq("id", typedExisting.id)
            .single();

          if (rule) {
            const typedRule = rule as unknown as { confirmation_count: number };
            await supabase
              .from("vendor_rules")
              .update({
                confirmation_count: typedRule.confirmation_count + 1,
                category_id: input.category_id,
                category_name: input.category_name ?? "",
                updated_at: new Date().toISOString(),
              })
              .eq("id", typedExisting.id);
          }
        }
      }

      return { transaction_id: input.transaction_id };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["unmatched-transactions", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["all-recent-transactions", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["match-results", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["open-invoices", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["vendor-rules", variables.user_id] });
      toast.success("Match accepted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to accept match");
    },
  });
}

// ────────────────────────────────────────────
// Dismiss Match Mutation
// ────────────────────────────────────────────

export function useDismissMatch() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      transaction_id: string;
      user_id: string;
    }) => {
      // Mark the suggestion as dismissed so it doesn't show again
      const { error } = await supabase
        .from("bank_transactions")
        .update({
          match_dismissed: true,
          match_dismissed_at: new Date().toISOString(),
        })
        .eq("id", input.transaction_id);

      if (error) throw error;
      return { transaction_id: input.transaction_id };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["unmatched-transactions", variables.user_id] });
      qc.invalidateQueries({ queryKey: ["match-results", variables.user_id] });
      toast.success("Suggestion dismissed");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to dismiss match");
    },
  });
}
