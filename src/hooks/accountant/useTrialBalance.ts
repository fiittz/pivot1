import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TrialBalanceLine {
  accountName: string;
  accountType: string;
  accountCode: string | null;
  debit: number;
  credit: number;
  transactionCount: number;
}

export interface TrialBalanceData {
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  difference: number;
}

export interface TBFlag {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  client_user_id: string;
  tax_year: number;
  account_name: string;
  account_type: string;
  flagged_amount: number;
  flag_type: "query" | "warning" | "adjustment_needed";
  note: string;
  status: "open" | "responded" | "resolved";
  client_response: string | null;
  resolved_at: string | null;
  document_request_id: string | null;
  created_at: string;
}

// Account type → debit or credit normal balance (DEAD CLIC)
const DEBIT_NORMAL: Record<string, boolean> = {
  Income: false,
  "Cost of Sales": true,
  Expense: true,
  VAT: false, // VAT liability = credit normal
  Payroll: true,
  "Fixed Assets": true,
  "Current Assets": true,
  "Current Liabilities": false,
  Equity: false,
  bank: true,
};

/**
 * Compute a trial balance for a client for a given tax year.
 * Groups all transactions by their nominal account and sums debit/credit.
 */
export function useClientTrialBalance(
  clientUserId: string | null | undefined,
  taxYear: number,
  accountIds?: string[],
) {
  return useQuery({
    queryKey: ["client-trial-balance", clientUserId, taxYear, "with-journals", accountIds ?? "all"],
    queryFn: async (): Promise<TrialBalanceData> => {
      const emptyResult: TrialBalanceData = { lines: [], totalDebit: 0, totalCredit: 0, isBalanced: true, difference: 0 };

      try {
      const startDate = `${taxYear}-01-01`;
      const endDate = `${taxYear}-12-31`;

      // Fetch transactions with category and account info
      let txnQuery = supabase
        .from("transactions")
        .select(`
          id, amount, type,
          category:categories(id, name, account_code),
          account:accounts(id, name, account_type, account_number)
        `)
        .eq("user_id", clientUserId!)
        .gte("transaction_date", startDate)
        .lte("transaction_date", endDate);

      // Filter by selected accounts if provided
      if (accountIds && accountIds.length > 0) {
        txnQuery = txnQuery.in("account_id", accountIds);
      }

      const { data: transactions, error } = await txnQuery;

      if (error) throw error;

      // Fetch journal entry lines for this client/year (exclude reversed entries)
      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("id")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .eq("is_reversed", false);

      let journalLines: { account_name: string; account_type: string; account_code: string | null; debit: number; credit: number }[] = [];
      if (journalEntries && journalEntries.length > 0) {
        const entryIds = journalEntries.map((e: { id: string }) => e.id);
        const { data: jLines } = await supabase
          .from("journal_entry_lines")
          .select("account_name, account_type, account_code, debit, credit")
          .in("journal_entry_id", entryIds);
        journalLines = (jLines ?? []) as typeof journalLines;
      }

      // Group by nominal account
      const accountMap = new Map<string, {
        accountName: string;
        accountType: string;
        accountCode: string | null;
        totalAmount: number;
        isDebitNormal: boolean;
        count: number;
      }>();

      for (const txn of transactions ?? []) {
        const account = txn.account as { id: string; name: string; account_type: string; account_number: string | null } | null;
        const category = txn.category as { id: string; name: string; account_code: string | null } | null;

        // Determine account name and type
        const accountName = account?.name || category?.name || "Uncategorised";
        const accountType = account?.account_type || (txn.type === "income" ? "Income" : "Expense");
        const accountCode = account?.account_number || category?.account_code || null;
        const key = `${accountType}::${accountName}`;

        const existing = accountMap.get(key);
        const amount = Math.abs(Number(txn.amount) || 0);
        const isIncome = txn.type === "income";

        // For income: credit increases (positive amount = credit)
        // For expense: debit increases (positive amount = debit)
        const signedAmount = isIncome ? -amount : amount; // negative = credit side

        if (existing) {
          existing.totalAmount += signedAmount;
          existing.count += 1;
        } else {
          accountMap.set(key, {
            accountName,
            accountType,
            accountCode,
            totalAmount: signedAmount,
            isDebitNormal: DEBIT_NORMAL[accountType] ?? true,
            count: 1,
          });
        }
      }

      // Merge journal entry lines into the account map
      for (const jl of journalLines) {
        const accountName = jl.account_name;
        const accountType = jl.account_type;
        const accountCode = jl.account_code ?? null;
        const key = `${accountType}::${accountName}`;
        const debitAmt = Number(jl.debit) || 0;
        const creditAmt = Number(jl.credit) || 0;
        // Journal lines: debit is positive, credit is negative in our internal representation
        const signedAmount = debitAmt - creditAmt;

        const existing = accountMap.get(key);
        if (existing) {
          existing.totalAmount += signedAmount;
          existing.count += 1;
        } else {
          accountMap.set(key, {
            accountName,
            accountType,
            accountCode,
            totalAmount: signedAmount,
            isDebitNormal: DEBIT_NORMAL[accountType] ?? true,
            count: 1,
          });
        }
      }

      // Convert to debit/credit columns
      const lines: TrialBalanceLine[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      // Sort: Income first, then CoS, Expenses, Assets, Liabilities, Equity
      const typeOrder: Record<string, number> = {
        Income: 1,
        "Cost of Sales": 2,
        Expense: 3,
        Payroll: 4,
        "Fixed Assets": 5,
        "Current Assets": 6,
        VAT: 7,
        "Current Liabilities": 8,
        Equity: 9,
        bank: 10,
      };

      const sorted = Array.from(accountMap.entries()).sort((a, b) => {
        const orderA = typeOrder[a[1].accountType] ?? 99;
        const orderB = typeOrder[b[1].accountType] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a[1].accountName.localeCompare(b[1].accountName);
      });

      for (const [, entry] of sorted) {
        const debit = entry.totalAmount > 0 ? entry.totalAmount : 0;
        const credit = entry.totalAmount < 0 ? Math.abs(entry.totalAmount) : 0;

        totalDebit += debit;
        totalCredit += credit;

        lines.push({
          accountName: entry.accountName,
          accountType: entry.accountType,
          accountCode: entry.accountCode,
          debit,
          credit,
          transactionCount: entry.count,
        });
      }

      const difference = Math.abs(totalDebit - totalCredit);

      return {
        lines,
        totalDebit,
        totalCredit,
        isBalanced: difference < 0.01,
        difference,
      };
      } catch {
        console.warn(`[useClientTrialBalance] Failed to fetch trial balance for client ${clientUserId}`);
        return emptyResult;
      }
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Load flags for a client's trial balance.
 */
export function useTrialBalanceFlags(
  accountantClientId: string | null | undefined,
  taxYear: number,
) {
  return useQuery({
    queryKey: ["tb-flags", accountantClientId, taxYear],
    queryFn: async (): Promise<TBFlag[]> => {
      const { data, error } = await supabase
        .from("trial_balance_flags")
        .select("*")
        .eq("accountant_client_id", accountantClientId!)
        .eq("tax_year", taxYear)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as TBFlag[];
    },
    enabled: !!accountantClientId,
  });
}

/**
 * Create a flag on a trial balance line + optionally create a document request.
 */
export function useCreateTBFlag() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      accountantClientId: string;
      clientUserId: string;
      taxYear: number;
      accountName: string;
      accountType: string;
      flaggedAmount: number;
      flagType: "query" | "warning" | "adjustment_needed";
      note: string;
      createDocRequest?: boolean;
    }) => {
      // Optionally create a document request first
      let docRequestId: string | null = null;
      if (input.createDocRequest) {
        const { data: docReq, error: docErr } = await supabase
          .from("document_requests")
          .insert({
            accountant_client_id: input.accountantClientId,
            accountant_id: user!.id,
            client_user_id: input.clientUserId,
            title: `Query: ${input.accountName}`,
            description: input.note,
            category: "trial_balance_query",
          })
          .select("id")
          .single();

        if (docErr) throw docErr;
        docRequestId = docReq.id;
      }

      // Create the flag
      const { data, error } = await supabase
        .from("trial_balance_flags")
        .insert({
          accountant_client_id: input.accountantClientId,
          accountant_id: user!.id,
          client_user_id: input.clientUserId,
          tax_year: input.taxYear,
          account_name: input.accountName,
          account_type: input.accountType,
          flagged_amount: input.flaggedAmount,
          flag_type: input.flagType,
          note: input.note,
          document_request_id: docRequestId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tb-flags", variables.accountantClientId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["document-requests", "by-client", variables.accountantClientId] });
      toast.success("Flag created — client will be notified");
    },
    onError: () => {
      toast.error("Failed to create flag");
    },
  });
}

/**
 * Resolve a flag.
 */
export function useResolveTBFlag() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { flagId: string; accountantClientId: string; taxYear: number }) => {
      const { error } = await supabase
        .from("trial_balance_flags")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user!.id,
        })
        .eq("id", input.flagId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["tb-flags", variables.accountantClientId, variables.taxYear] });
    },
  });
}
