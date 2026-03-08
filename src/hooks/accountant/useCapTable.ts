import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface ShareClass {
  id: string;
  class_name: string;
  nominal_value: number;
  voting_rights: boolean;
  dividend_rights: boolean;
  currency: string;
  total_authorised: number | null;
  notes: string | null;
}

export type ShareholderType = "individual" | "company" | "trust" | "nominee";

export interface ShareAllocation {
  id: string;
  shareholder_id: string;
  share_class_id: string;
  share_class_name: string;
  num_shares: number;
  date_acquired: string;
  acquisition_type: string;
  price_per_share: number;
  total_consideration: number;
  date_disposed: string | null;
  disposal_type: string | null;
  transferred_to: string | null;
  certificate_number: string | null;
  notes: string | null;
}

export interface Shareholder {
  id: string;
  shareholder_name: string;
  shareholder_type: ShareholderType;
  ppsn: string | null;
  company_number: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  is_director: boolean;
  employee_id: string | null;
  is_active: boolean;
  notes: string | null;
  allocations: ShareAllocation[];
  totalShares: number;
  ownershipPct: number;
}

// ────────────────────────────────────────────
// Main query hook
// ────────────────────────────────────────────

export function useCapTable(clientUserId: string | null | undefined) {
  return useQuery({
    queryKey: ["cap-table", clientUserId],
    queryFn: async () => {
      // Fetch share classes
      const { data: classesRaw, error: classErr } = await supabase
        .from("share_classes" as string)
        .select("*")
        .eq("user_id", clientUserId!);
      if (classErr) throw classErr;

      const shareClasses: ShareClass[] = ((classesRaw ?? []) as Record<string, unknown>[]).map((c) => ({
        id: c.id as string,
        class_name: c.class_name as string,
        nominal_value: Number(c.nominal_value),
        voting_rights: c.voting_rights as boolean,
        dividend_rights: c.dividend_rights as boolean,
        currency: c.currency as string,
        total_authorised: c.total_authorised as number | null,
        notes: c.notes as string | null,
      }));

      // Fetch shareholders
      const { data: holdersRaw, error: holderErr } = await supabase
        .from("shareholders" as string)
        .select("*")
        .eq("user_id", clientUserId!)
        .order("shareholder_name");
      if (holderErr) throw holderErr;

      // Fetch allocations
      const { data: allocsRaw, error: allocErr } = await supabase
        .from("share_allocations" as string)
        .select("*")
        .eq("user_id", clientUserId!)
        .order("date_acquired", { ascending: true });
      if (allocErr) throw allocErr;

      // Build a class name lookup
      const classNameMap = new Map<string, string>();
      for (const sc of shareClasses) {
        classNameMap.set(sc.id, sc.class_name);
      }

      // Map allocations
      const allAllocations: ShareAllocation[] = ((allocsRaw ?? []) as Record<string, unknown>[]).map((a) => ({
        id: a.id as string,
        shareholder_id: a.shareholder_id as string,
        share_class_id: a.share_class_id as string,
        share_class_name: classNameMap.get(a.share_class_id as string) ?? "Unknown",
        num_shares: Number(a.num_shares),
        date_acquired: a.date_acquired as string,
        acquisition_type: a.acquisition_type as string,
        price_per_share: Number(a.price_per_share),
        total_consideration: Number(a.total_consideration),
        date_disposed: a.date_disposed as string | null,
        disposal_type: a.disposal_type as string | null,
        transferred_to: a.transferred_to as string | null,
        certificate_number: a.certificate_number as string | null,
        notes: a.notes as string | null,
      }));

      // Compute total shares issued (active allocations only)
      const totalSharesIssued = allAllocations
        .filter((a) => !a.date_disposed)
        .reduce((sum, a) => sum + a.num_shares, 0);

      // Build shareholders with computed fields
      const shareholders: Shareholder[] = ((holdersRaw ?? []) as Record<string, unknown>[]).map((h) => {
        const holderId = h.id as string;
        const holderAllocs = allAllocations.filter(
          (a) => a.shareholder_id === holderId && !a.date_disposed,
        );
        const totalShares = holderAllocs.reduce((sum, a) => sum + a.num_shares, 0);
        const ownershipPct = totalSharesIssued > 0 ? (totalShares / totalSharesIssued) * 100 : 0;

        return {
          id: holderId,
          shareholder_name: h.shareholder_name as string,
          shareholder_type: h.shareholder_type as ShareholderType,
          ppsn: h.ppsn as string | null,
          company_number: h.company_number as string | null,
          address: h.address as string | null,
          email: h.email as string | null,
          phone: h.phone as string | null,
          is_director: h.is_director as boolean,
          employee_id: h.employee_id as string | null,
          is_active: h.is_active as boolean,
          notes: h.notes as string | null,
          allocations: holderAllocs,
          totalShares,
          ownershipPct,
        };
      });

      // Close company test: 5 or fewer participators control >50%
      const sortedByShares = [...shareholders]
        .filter((s) => s.is_active)
        .sort((a, b) => b.totalShares - a.totalShares);
      const top5Shares = sortedByShares.slice(0, 5).reduce((sum, s) => sum + s.totalShares, 0);
      const isCloseCompany = totalSharesIssued > 0 && top5Shares > totalSharesIssued / 2;

      return {
        shareClasses,
        shareholders,
        totalSharesIssued,
        isCloseCompany,
      };
    },
    enabled: !!clientUserId,
  });
}

// ────────────────────────────────────────────
// Mutations
// ────────────────────────────────────────────

export function useCreateShareClass() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      class_name: string;
      nominal_value: number;
      voting_rights: boolean;
      dividend_rights: boolean;
      currency: string;
      total_authorised?: number | null;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("share_classes" as string)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cap-table", variables.user_id] });
      toast.success("Share class created");
    },
    onError: (err: Error) => {
      toast.error(err.message?.includes("unique") ? "A share class with that name already exists" : "Failed to create share class");
    },
  });
}

export function useCreateShareholder() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      shareholder_name: string;
      shareholder_type: ShareholderType;
      ppsn?: string;
      company_number?: string;
      address?: string;
      email?: string;
      phone?: string;
      is_director: boolean;
      employee_id?: string | null;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("shareholders" as string)
        .insert({
          ...input,
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cap-table", variables.user_id] });
      toast.success("Shareholder added");
    },
    onError: () => {
      toast.error("Failed to add shareholder");
    },
  });
}

export function useUpdateShareholder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      user_id: string;
      updates: Partial<{
        shareholder_name: string;
        shareholder_type: ShareholderType;
        ppsn: string | null;
        company_number: string | null;
        address: string | null;
        email: string | null;
        phone: string | null;
        is_director: boolean;
        employee_id: string | null;
        is_active: boolean;
        notes: string | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("shareholders" as string)
        .update({ ...input.updates, updated_at: new Date().toISOString() })
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cap-table", variables.user_id] });
      toast.success("Shareholder updated");
    },
    onError: () => {
      toast.error("Failed to update shareholder");
    },
  });
}

export function useAllocateShares() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      shareholder_id: string;
      share_class_id: string;
      num_shares: number;
      date_acquired: string;
      acquisition_type: string;
      price_per_share: number;
      total_consideration: number;
      certificate_number?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("share_allocations" as string)
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cap-table", variables.user_id] });
      toast.success("Shares allocated");
    },
    onError: () => {
      toast.error("Failed to allocate shares");
    },
  });
}

export function useTransferShares() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      user_id: string;
      from_allocation_id: string;
      to_shareholder_id: string;
      share_class_id: string;
      num_shares: number;
      transfer_date: string;
      price_per_share: number;
    }) => {
      // Mark the old allocation as disposed
      const { error: disposeErr } = await supabase
        .from("share_allocations" as string)
        .update({
          date_disposed: input.transfer_date,
          disposal_type: "transfer_out",
          transferred_to: input.to_shareholder_id,
        })
        .eq("id", input.from_allocation_id);
      if (disposeErr) throw disposeErr;

      // Create new allocation for the recipient
      const { data, error: allocErr } = await supabase
        .from("share_allocations" as string)
        .insert({
          user_id: input.user_id,
          shareholder_id: input.to_shareholder_id,
          share_class_id: input.share_class_id,
          num_shares: input.num_shares,
          date_acquired: input.transfer_date,
          acquisition_type: "transfer_in",
          price_per_share: input.price_per_share,
          total_consideration: input.num_shares * input.price_per_share,
        })
        .select()
        .single();
      if (allocErr) throw allocErr;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["cap-table", variables.user_id] });
      toast.success("Shares transferred");
    },
    onError: () => {
      toast.error("Failed to transfer shares");
    },
  });
}
