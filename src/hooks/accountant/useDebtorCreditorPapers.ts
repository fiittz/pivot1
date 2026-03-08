import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type PaperType = "debtors" | "creditors";
export type LineType = "trade" | "accrued_income" | "prepayment_received" | "accrual" | "prepayment_made";
export type LineSource = "manual" | "invoice" | "receipt" | "imported";
export type ConfirmationStatus = "confirmed" | "disputed" | "paid" | "partial" | "unknown";
export type PaperStatus = "draft" | "sent_for_confirmation" | "confirmed" | "finalised";

export interface DebtorCreditorPaper {
  id: string;
  user_id: string;
  created_by: string;
  accountant_client_id: string;
  tax_year: number;
  paper_type: PaperType;
  as_at_date: string;
  status: PaperStatus;
  notes: string | null;
  reconciliation_request_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
  lines: DebtorCreditorLine[];
}

export interface DebtorCreditorLine {
  id: string;
  paper_id: string;
  counterparty_name: string;
  line_type: LineType;
  reference: string | null;
  original_date: string | null;
  due_date: string | null;
  amount: number;
  source: LineSource;
  source_id: string | null;
  confirmed_amount: number | null;
  confirmation_status: ConfirmationStatus | null;
  confirmation_note: string | null;
  confirmed_at: string | null;
  sort_order: number;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

export function getAgeBucket(dueDate: string | null, asAtDate: string): "current" | "30-60" | "60-90" | "90+" {
  if (!dueDate) return "current";
  const due = new Date(dueDate);
  const asAt = new Date(asAtDate);
  const days = Math.floor((asAt.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return "current";
  if (days <= 60) return "30-60";
  if (days <= 90) return "60-90";
  return "90+";
}

// ────────────────────────────────────────────
// Queries
// ────────────────────────────────────────────

export function useDebtorCreditorPaper(
  clientUserId: string | null | undefined,
  taxYear: number,
  paperType: PaperType,
) {
  return useQuery({
    queryKey: ["debtor-creditor-paper", clientUserId, taxYear, paperType],
    queryFn: async (): Promise<DebtorCreditorPaper | null> => {
      // Fetch the paper
      const { data: papers, error } = await supabase
        .from("debtor_creditor_papers")
        .select("*")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .eq("paper_type", paperType)
        .limit(1);

      if (error) throw error;
      if (!papers || papers.length === 0) return null;

      const paper = papers[0] as unknown as Omit<DebtorCreditorPaper, "lines">;

      // Fetch lines
      const { data: lines, error: linesError } = await supabase
        .from("debtor_creditor_lines")
        .select("*")
        .eq("paper_id", paper.id)
        .order("sort_order", { ascending: true });

      if (linesError) throw linesError;

      return {
        ...paper,
        lines: (lines ?? []) as unknown as DebtorCreditorLine[],
      };
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────

export function useCreatePaper() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      accountant_client_id: string;
      tax_year: number;
      paper_type: PaperType;
      as_at_date: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("debtor_creditor_papers")
        .upsert(
          {
            user_id: input.user_id,
            created_by: user!.id,
            accountant_client_id: input.accountant_client_id,
            tax_year: input.tax_year,
            paper_type: input.paper_type,
            as_at_date: input.as_at_date,
            notes: input.notes ?? null,
            status: "draft",
          },
          { onConflict: "user_id,tax_year,paper_type" },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", variables.user_id, variables.tax_year, variables.paper_type],
      });
      toast.success("Working paper created");
    },
    onError: () => {
      toast.error("Failed to create working paper");
    },
  });
}

export function useAddLine() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      paper_id: string;
      counterparty_name: string;
      line_type: LineType;
      reference?: string;
      original_date?: string;
      due_date?: string;
      amount: number;
      source?: LineSource;
      source_id?: string;
      sort_order?: number;
      // For cache invalidation
      _clientUserId: string;
      _taxYear: number;
      _paperType: PaperType;
    }) => {
      const { _clientUserId, _taxYear, _paperType, ...insertData } = input;
      void _clientUserId;
      void _taxYear;
      void _paperType;

      const { data, error } = await supabase
        .from("debtor_creditor_lines")
        .insert({
          paper_id: insertData.paper_id,
          counterparty_name: insertData.counterparty_name,
          line_type: insertData.line_type,
          reference: insertData.reference ?? null,
          original_date: insertData.original_date ?? null,
          due_date: insertData.due_date ?? null,
          amount: insertData.amount,
          source: insertData.source ?? "manual",
          source_id: insertData.source_id ?? null,
          sort_order: insertData.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", variables._clientUserId, variables._taxYear, variables._paperType],
      });
      toast.success("Line added");
    },
    onError: () => {
      toast.error("Failed to add line");
    },
  });
}

export function useUpdateLine() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      updates: Partial<Pick<DebtorCreditorLine, "counterparty_name" | "line_type" | "reference" | "original_date" | "due_date" | "amount" | "sort_order" | "confirmed_amount" | "confirmation_status" | "confirmation_note" | "confirmed_at">>;
      _clientUserId: string;
      _taxYear: number;
      _paperType: PaperType;
    }) => {
      const { data, error } = await supabase
        .from("debtor_creditor_lines")
        .update(input.updates)
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", variables._clientUserId, variables._taxYear, variables._paperType],
      });
    },
    onError: () => {
      toast.error("Failed to update line");
    },
  });
}

export function useDeleteLine() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      _clientUserId: string;
      _taxYear: number;
      _paperType: PaperType;
    }) => {
      const { error } = await supabase
        .from("debtor_creditor_lines")
        .delete()
        .eq("id", input.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", variables._clientUserId, variables._taxYear, variables._paperType],
      });
      toast.success("Line deleted");
    },
    onError: () => {
      toast.error("Failed to delete line");
    },
  });
}

export function useImportFromInvoices() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      paper_id: string;
      clientUserId: string;
      taxYear: number;
      paperType: PaperType;
      existingSourceIds: string[];
    }) => {
      // Fetch unpaid invoices for this client within the tax year
      const startDate = `${input.taxYear}-01-01`;
      const endDate = `${input.taxYear}-12-31`;

      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*, customer:customers(id, name)")
        .eq("user_id", input.clientUserId)
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)
        .not("status", "in", '("paid","cancelled","draft")');

      if (error) throw error;
      if (!invoices || invoices.length === 0) return 0;

      // Filter out invoices that already have a corresponding line
      const existingSet = new Set(input.existingSourceIds);
      const newInvoices = (invoices as Record<string, unknown>[]).filter(
        (inv) => !existingSet.has(inv.id as string),
      );

      if (newInvoices.length === 0) return 0;

      // Create lines for each new invoice
      const lines = newInvoices.map((inv, idx) => {
        const customer = inv.customer as Record<string, unknown> | null;
        return {
          paper_id: input.paper_id,
          counterparty_name: (customer?.name as string) ?? "Unknown Customer",
          line_type: "trade" as const,
          reference: (inv.invoice_number as string) ?? null,
          original_date: (inv.invoice_date as string) ?? null,
          due_date: (inv.due_date as string) ?? (inv.invoice_date as string) ?? null,
          amount: Math.abs(Number(inv.total_amount ?? inv.amount) || 0),
          source: "invoice" as const,
          source_id: inv.id as string,
          sort_order: idx,
        };
      });

      const { error: insertError } = await supabase
        .from("debtor_creditor_lines")
        .insert(lines);

      if (insertError) throw insertError;
      return lines.length;
    },
    onSuccess: (count, variables) => {
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", variables.clientUserId, variables.taxYear, variables.paperType],
      });
      if (count > 0) {
        toast.success(`Imported ${count} invoice${count !== 1 ? "s" : ""}`);
      } else {
        toast.info("No new invoices to import");
      }
    },
    onError: () => {
      toast.error("Failed to import invoices");
    },
  });
}

export function useSendForConfirmation() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      paper: DebtorCreditorPaper;
      accountantClientId: string;
      clientName: string;
    }) => {
      const { paper, accountantClientId } = input;

      // Create reconciliation request
      const requestType = paper.paper_type === "debtors" ? "aged_debtors" : "aged_creditors";
      const { data: request, error: reqError } = await supabase
        .from("reconciliation_requests")
        .insert({
          accountant_client_id: accountantClientId,
          accountant_id: user!.id,
          client_user_id: paper.user_id,
          request_type: requestType,
          title: `${paper.paper_type === "debtors" ? "Debtors" : "Creditors"} Confirmation — Year ${paper.tax_year}`,
          note: `Please confirm the following ${paper.paper_type} balances as at ${paper.as_at_date}.`,
          as_at_date: paper.as_at_date,
        })
        .select()
        .single();

      if (reqError) throw reqError;

      const typedRequest = request as unknown as { id: string };

      // Create reconciliation request lines from paper lines
      const reconLines = paper.lines.map((line, idx) => ({
        request_id: typedRequest.id,
        label: line.counterparty_name,
        reference: line.reference,
        expected_amount: line.amount,
        sort_order: idx,
      }));

      if (reconLines.length > 0) {
        const { error: linesError } = await supabase
          .from("reconciliation_request_lines")
          .insert(reconLines);

        if (linesError) throw linesError;
      }

      // Update the paper
      const { error: updateError } = await supabase
        .from("debtor_creditor_papers")
        .update({
          reconciliation_request_id: typedRequest.id,
          status: "sent_for_confirmation",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper.id);

      if (updateError) throw updateError;

      return typedRequest;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: [
          "debtor-creditor-paper",
          variables.paper.user_id,
          variables.paper.tax_year,
          variables.paper.paper_type,
        ],
      });
      toast.success("Sent to client for confirmation");
    },
    onError: () => {
      toast.error("Failed to send for confirmation");
    },
  });
}

export function useFinaliseAndPostJournal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      paper: DebtorCreditorPaper;
    }) => {
      const { paper } = input;
      const entryDate = paper.as_at_date;

      // Build journal entry lines based on paper type and line types
      const journalLines: Array<{
        account_name: string;
        account_type: string;
        debit: number;
        credit: number;
        description: string;
      }> = [];

      for (const line of paper.lines) {
        const amt = Number(line.amount);
        if (amt === 0) continue;

        if (paper.paper_type === "debtors") {
          switch (line.line_type) {
            case "trade":
              journalLines.push({
                account_name: "Trade Debtors",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — ${line.reference ?? "trade debtor"}`,
              });
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — ${line.reference ?? "trade debtor"}`,
              });
              break;
            case "accrued_income":
              journalLines.push({
                account_name: "Accrued Income",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — accrued income`,
              });
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — accrued income`,
              });
              break;
            case "prepayment_received":
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — prepayment received`,
              });
              journalLines.push({
                account_name: "Deferred Income",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — prepayment received`,
              });
              break;
          }
        } else {
          // creditors
          switch (line.line_type) {
            case "trade":
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — ${line.reference ?? "trade creditor"}`,
              });
              journalLines.push({
                account_name: "Trade Creditors",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — ${line.reference ?? "trade creditor"}`,
              });
              break;
            case "accrual":
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — accrual`,
              });
              journalLines.push({
                account_name: "Accruals",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — accrual`,
              });
              break;
            case "prepayment_made":
              journalLines.push({
                account_name: "Prepayments",
                account_type: "current_asset",
                debit: amt,
                credit: 0,
                description: `${line.counterparty_name} — prepayment made`,
              });
              journalLines.push({
                account_name: "Suspense",
                account_type: "current_liability",
                debit: 0,
                credit: amt,
                description: `${line.counterparty_name} — prepayment made`,
              });
              break;
          }
        }
      }

      if (journalLines.length < 2) {
        throw new Error("No lines to post — add at least one line first");
      }

      // Create the journal entry
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: paper.user_id,
          accountant_id: user!.id,
          entry_date: entryDate,
          description: `${paper.paper_type === "debtors" ? "Debtors" : "Creditors"} Working Paper — Year ${paper.tax_year}`,
          reference: `WP-${paper.paper_type.toUpperCase().slice(0, 3)}-${paper.tax_year}`,
          entry_type: "adjustment",
          tax_year: paper.tax_year,
          notes: `Auto-posted from ${paper.paper_type} working paper`,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const typedEntry = entry as unknown as { id: string };

      // Insert journal lines
      const jlInserts = journalLines.map((jl) => ({
        journal_entry_id: typedEntry.id,
        account_name: jl.account_name,
        account_type: jl.account_type,
        debit: jl.debit,
        credit: jl.credit,
        description: jl.description,
      }));

      const { error: jlError } = await supabase
        .from("journal_entry_lines")
        .insert(jlInserts);

      if (jlError) throw jlError;

      // Update the paper
      const { error: updateError } = await supabase
        .from("debtor_creditor_papers")
        .update({
          journal_entry_id: typedEntry.id,
          status: "finalised",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paper.id);

      if (updateError) throw updateError;

      return typedEntry;
    },
    onSuccess: (_data, variables) => {
      const { paper } = variables;
      qc.invalidateQueries({
        queryKey: ["debtor-creditor-paper", paper.user_id, paper.tax_year, paper.paper_type],
      });
      qc.invalidateQueries({ queryKey: ["client-journal-entries", paper.user_id, paper.tax_year] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", paper.user_id, paper.tax_year] });
      toast.success("Finalised — journal entry posted");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to finalise");
    },
  });
}
