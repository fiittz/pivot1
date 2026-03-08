import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export type JournalEntryType =
  | "adjustment"
  | "accrual"
  | "depreciation"
  | "bad_debt"
  | "correction"
  | "opening_balance"
  | "closing";

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_name: string;
  account_type: string;
  account_code: string | null;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  accountant_id: string;
  entry_date: string;
  description: string;
  reference: string;
  entry_type: JournalEntryType;
  tax_year: number;
  is_reversed: boolean;
  reversed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines: JournalEntryLine[];
}

export interface JournalEntryLineInput {
  account_name: string;
  account_type: string;
  account_code?: string | null;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface CreateJournalEntryInput {
  clientUserId: string;
  entryDate: string;
  description: string;
  reference: string;
  entryType: JournalEntryType;
  taxYear: number;
  notes?: string | null;
  lines: JournalEntryLineInput[];
}

// ────────────────────────────────────────────
// Load all journal entries for a client/year
// ────────────────────────────────────────────

export function useClientJournalEntries(
  clientUserId: string | null | undefined,
  taxYear: number,
) {
  return useQuery({
    queryKey: ["client-journal-entries", clientUserId, taxYear],
    queryFn: async (): Promise<JournalEntry[]> => {
      // Fetch journal entries
      const { data: entries, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .order("entry_date", { ascending: false });

      if (error) throw error;
      if (!entries || entries.length === 0) return [];

      // Fetch all lines for these entries
      const entryIds = entries.map((e: Record<string, unknown>) => e.id as string);
      const { data: lines, error: linesError } = await supabase
        .from("journal_entry_lines")
        .select("*")
        .in("journal_entry_id", entryIds);

      if (linesError) throw linesError;

      // Group lines by entry ID
      const linesByEntry = new Map<string, JournalEntryLine[]>();
      for (const line of (lines ?? []) as unknown as JournalEntryLine[]) {
        const existing = linesByEntry.get(line.journal_entry_id) ?? [];
        existing.push(line);
        linesByEntry.set(line.journal_entry_id, existing);
      }

      return (entries as unknown as Omit<JournalEntry, "lines">[]).map((entry) => ({
        ...entry,
        lines: linesByEntry.get(entry.id) ?? [],
      }));
    },
    enabled: !!clientUserId,
    staleTime: 2 * 60 * 1000,
  });
}

// ────────────────────────────────────────────
// Create a journal entry with lines
// ────────────────────────────────────────────

export function useCreateJournalEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateJournalEntryInput) => {
      // Validate debits = credits
      const totalDebit = input.lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
      const totalCredit = input.lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.005) {
        throw new Error(
          `Journal entry does not balance. Debits: ${totalDebit.toFixed(2)}, Credits: ${totalCredit.toFixed(2)}`,
        );
      }

      if (input.lines.length < 2) {
        throw new Error("A journal entry must have at least 2 lines");
      }

      // Insert the journal entry
      const { data: entry, error: entryError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: input.clientUserId,
          accountant_id: user!.id,
          entry_date: input.entryDate,
          description: input.description,
          reference: input.reference,
          entry_type: input.entryType,
          tax_year: input.taxYear,
          notes: input.notes ?? null,
        })
        .select()
        .single();

      if (entryError) throw entryError;

      const typedEntry = entry as unknown as { id: string };

      // Insert lines
      const lineInserts = input.lines.map((line) => ({
        journal_entry_id: typedEntry.id,
        account_name: line.account_name,
        account_type: line.account_type,
        account_code: line.account_code ?? null,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? null,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(lineInserts);

      if (linesError) throw linesError;

      return entry;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client-journal-entries", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", variables.clientUserId, variables.taxYear] });
      toast.success("Journal entry created");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create journal entry");
    },
  });
}

// ────────────────────────────────────────────
// Reverse a journal entry
// ────────────────────────────────────────────

export function useReverseJournalEntry() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      journalEntry: JournalEntry;
      clientUserId: string;
      taxYear: number;
    }) => {
      const { journalEntry } = input;

      if (journalEntry.is_reversed) {
        throw new Error("This journal entry has already been reversed");
      }

      // Create the reversing entry — swap debits and credits
      const { data: reversal, error: reversalError } = await supabase
        .from("journal_entries")
        .insert({
          user_id: journalEntry.user_id,
          accountant_id: user!.id,
          entry_date: new Date().toISOString().split("T")[0],
          description: `Reversal of ${journalEntry.reference}: ${journalEntry.description}`,
          reference: `${journalEntry.reference}-REV`,
          entry_type: journalEntry.entry_type,
          tax_year: journalEntry.tax_year,
          notes: `Reversal of journal entry ${journalEntry.reference}`,
        })
        .select()
        .single();

      if (reversalError) throw reversalError;

      const typedReversal = reversal as unknown as { id: string };

      // Insert reversed lines (swap debit/credit)
      const reversedLines = journalEntry.lines.map((line) => ({
        journal_entry_id: typedReversal.id,
        account_name: line.account_name,
        account_type: line.account_type,
        account_code: line.account_code,
        debit: Number(line.credit),
        credit: Number(line.debit),
        description: `Reversal: ${line.description ?? line.account_name}`,
      }));

      const { error: linesError } = await supabase
        .from("journal_entry_lines")
        .insert(reversedLines);

      if (linesError) throw linesError;

      // Mark original as reversed
      const { error: updateError } = await supabase
        .from("journal_entries")
        .update({
          is_reversed: true,
          reversed_by: typedReversal.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", journalEntry.id);

      if (updateError) throw updateError;

      return reversal;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client-journal-entries", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", variables.clientUserId, variables.taxYear] });
      toast.success("Journal entry reversed");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to reverse journal entry");
    },
  });
}

// ────────────────────────────────────────────
// Delete a journal entry
// ────────────────────────────────────────────

export function useDeleteJournalEntry() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      journalEntryId: string;
      clientUserId: string;
      taxYear: number;
    }) => {
      // Lines are cascade-deleted via FK
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", input.journalEntryId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["client-journal-entries", variables.clientUserId, variables.taxYear] });
      qc.invalidateQueries({ queryKey: ["client-trial-balance", variables.clientUserId, variables.taxYear] });
      toast.success("Journal entry deleted");
    },
    onError: () => {
      toast.error("Failed to delete journal entry");
    },
  });
}

// ────────────────────────────────────────────
// Get the next reference number
// ────────────────────────────────────────────

export function useNextJournalReference(
  clientUserId: string | null | undefined,
  taxYear: number,
) {
  return useQuery({
    queryKey: ["journal-next-ref", clientUserId, taxYear],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("reference")
        .eq("user_id", clientUserId!)
        .eq("tax_year", taxYear)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) return "JE-001";

      const lastRef = (data[0] as unknown as { reference: string }).reference;
      // Parse "JE-001" or "JE-001-REV" style references
      const match = lastRef.match(/JE-(\d+)/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        return `JE-${String(nextNum).padStart(3, "0")}`;
      }

      return `JE-001`;
    },
    enabled: !!clientUserId,
  });
}
