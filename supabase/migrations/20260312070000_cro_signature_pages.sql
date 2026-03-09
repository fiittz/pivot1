-- Migration: CRO Signature Pages table + storage bucket
-- Tracks signature page generation, sending, signing, and filing workflow

-- =============================================================================
-- 1. cro_signature_pages table
-- =============================================================================

CREATE TABLE public.cro_signature_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cro_company_id UUID NOT NULL REFERENCES public.cro_companies(id) ON DELETE CASCADE,
  cro_annual_accounts_id UUID REFERENCES public.cro_annual_accounts(id) ON DELETE SET NULL,
  financial_year_end DATE NOT NULL,
  -- PDF generation
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by UUID NOT NULL REFERENCES auth.users(id),
  pdf_storage_path TEXT, -- path in Supabase Storage
  -- Sending to client
  sent_to_email TEXT,
  sent_at TIMESTAMPTZ,
  -- Client response
  signed_pdf_storage_path TEXT, -- uploaded signed copy
  uploaded_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id),
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'signed', 'filed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cro_sig_pages_company ON cro_signature_pages(cro_company_id);

ALTER TABLE cro_signature_pages ENABLE ROW LEVEL SECURITY;

-- Users see their own (via cro_companies.user_id)
CREATE POLICY "Users see own signature pages" ON cro_signature_pages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM cro_companies cc WHERE cc.id = cro_signature_pages.cro_company_id AND cc.user_id = auth.uid()
  ));

-- Users can upload signed copies
CREATE POLICY "Users upload signed pages" ON cro_signature_pages FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM cro_companies cc WHERE cc.id = cro_signature_pages.cro_company_id AND cc.user_id = auth.uid()
  ));

-- Accountants full access
CREATE POLICY "Accountants manage signature pages" ON cro_signature_pages FOR ALL
  USING (public.is_accountant_for_cro_company(cro_company_id));

-- =============================================================================
-- 2. Storage bucket for CRO documents
-- =============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('cro-documents', 'cro-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder
CREATE POLICY "Users upload cro docs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cro-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own
CREATE POLICY "Users read own cro docs" ON storage.objects FOR SELECT
  USING (bucket_id = 'cro-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Accountants can read/write client docs
CREATE POLICY "Accountants manage cro docs" ON storage.objects FOR ALL
  USING (bucket_id = 'cro-documents');
