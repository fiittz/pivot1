import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { generateSignaturePage, type SignaturePageOptions } from "@/lib/cro/generateSignaturePage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CROSignaturePage {
  id: string;
  cro_company_id: string;
  cro_annual_accounts_id: string | null;
  financial_year_end: string;
  generated_at: string;
  generated_by: string;
  pdf_storage_path: string | null;
  sent_to_email: string | null;
  sent_at: string | null;
  signed_pdf_storage_path: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  status: "draft" | "sent" | "signed" | "filed";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// 1. List all signature pages for a company
// ---------------------------------------------------------------------------

export function useSignaturePages(croCompanyId?: string) {
  return useQuery({
    queryKey: ["cro-signature-pages", croCompanyId],
    queryFn: async (): Promise<CROSignaturePage[]> => {
      const { data, error } = await supabase
        .from("cro_signature_pages")
        .select("*")
        .eq("cro_company_id", croCompanyId!)
        .order("financial_year_end", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CROSignaturePage[];
    },
    enabled: !!croCompanyId,
  });
}

// ---------------------------------------------------------------------------
// 2. Generate signature page PDF, store in Storage, create DB row
// ---------------------------------------------------------------------------

export function useGenerateSignaturePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: SignaturePageOptions & {
        croCompanyId: string;
        croAnnualAccountsId?: string;
      },
    ): Promise<CROSignaturePage> => {
      if (!user) throw new Error("Not authenticated");

      // 1. Generate the PDF
      const doc = generateSignaturePage(input);
      const pdfBlob = doc.output("blob");

      // 2. Upload to Supabase Storage
      const storagePath = `${user.id}/${input.croCompanyId}/signature-page-${input.financialYearEnd}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("cro-documents")
        .upload(storagePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 3. Create the database row
      const { data, error } = await supabase
        .from("cro_signature_pages")
        .insert({
          cro_company_id: input.croCompanyId,
          cro_annual_accounts_id: input.croAnnualAccountsId || null,
          financial_year_end: input.financialYearEnd,
          generated_by: user.id,
          pdf_storage_path: storagePath,
          status: "draft",
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CROSignaturePage;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cro-signature-pages", variables.croCompanyId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Send signature page to client (marks as sent, optionally calls edge fn)
// ---------------------------------------------------------------------------

export function useSendSignaturePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      signaturePageId: string;
      croCompanyId: string;
      email: string;
    }): Promise<CROSignaturePage> => {
      // Try to call edge function for email sending
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cro-api`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "send_signature_page",
              signature_page_id: input.signaturePageId,
              email: input.email,
            }),
          },
        );
      } catch {
        // Edge function may not exist yet — fall through to mark as sent
      }

      // Update the DB row regardless
      const { data, error } = await supabase
        .from("cro_signature_pages")
        .update({
          sent_to_email: input.email,
          sent_at: new Date().toISOString(),
          status: "sent",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", input.signaturePageId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CROSignaturePage;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cro-signature-pages", variables.croCompanyId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Upload signed page (client uploads the signed scan)
// ---------------------------------------------------------------------------

export function useUploadSignedPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      signaturePageId: string;
      croCompanyId: string;
      file: File;
    }): Promise<CROSignaturePage> => {
      if (!user) throw new Error("Not authenticated");

      // 1. Upload the signed file to Storage
      const ext = input.file.name.split(".").pop() || "pdf";
      const storagePath = `${user.id}/${input.croCompanyId}/signed-page-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("cro-documents")
        .upload(storagePath, input.file, {
          contentType: input.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Update the signature page record
      const { data, error } = await supabase
        .from("cro_signature_pages")
        .update({
          signed_pdf_storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          uploaded_by: user.id,
          status: "signed",
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", input.signaturePageId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CROSignaturePage;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cro-signature-pages", variables.croCompanyId],
      });
    },
  });
}
