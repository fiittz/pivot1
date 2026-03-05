// Accountant domain types — Phase 1+

export type UserRoleType = 'owner' | 'accountant' | 'platform_admin';

export type AccountantStatus = "active" | "revoked" | "suspended";

export interface ApprovedAccountant {
  id: string;
  email: string;
  approved_by: string | null;
  status: AccountantStatus;
  created_at: string;
}

export interface RegisteredAccountant {
  user_id: string;
  email: string;
  display_name: string;
  signed_up_at: string;
  status: AccountantStatus;
  client_count: number;
}

export interface AdminClientView {
  client_id: string;
  email: string;
  business_name: string | null;
  signed_up_at: string;
  transaction_count: number;
}

export interface PlatformOverview {
  total_users: number;
  active_accountants: number;
  suspended_accountants: number;
  whitelisted_emails: number;
  total_transactions: number;
  businesses_with_transactions: number;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface AccountantPractice {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_agent_number: string | null; // TAIN
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

// Phase 2: Client Management

export type ClientStatus = 'pending_invite' | 'active' | 'suspended' | 'archived';
export type AccessLevel = 'read_only' | 'read_write' | 'full';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface AccountantClient {
  id: string;
  practice_id: string;
  accountant_id: string;
  client_user_id: string | null;
  client_name: string;
  client_email: string;
  client_business_name: string | null;
  client_phone: string | null;
  status: ClientStatus;
  access_level: AccessLevel;
  notes: string | null;
  tags: string[];
  engagement_type: string | null;
  fee_amount: number | null;
  fee_frequency: string | null;
  year_end_month: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInvitation {
  id: string;
  accountant_client_id: string;
  practice_id: string;
  accountant_id: string;
  invite_email: string;
  invite_token: string;
  status: InviteStatus;
  message: string | null;
  expires_at: string;
  created_at: string;
}

// Phase 4: CRM

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface ClientNote {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientTask {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  completed_at: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
}

// Phase 5: Document Requests

export type DocumentRequestStatus = 'pending' | 'uploaded' | 'accepted' | 'rejected';

export interface DocumentRequest {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  client_user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: DocumentRequestStatus;
  due_date: string | null;
  uploaded_file_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Phase 6: Filing Records

export type FilingType = 'ct1' | 'form11' | 'vat3' | 'rct_monthly' | 'b1' | 'annual_return';
export type FilingStatus = 'draft' | 'in_review' | 'approved' | 'filed' | 'acknowledged';

export interface FilingRecord {
  id: string;
  accountant_client_id: string;
  accountant_id: string;
  client_user_id: string;
  filing_type: FilingType;
  tax_period_start: string;
  tax_period_end: string;
  status: FilingStatus;
  questionnaire_snapshot: Record<string, unknown> | null;
  accountant_reviewed: boolean;
  accountant_approved: boolean;
  accountant_review_notes: string | null;
  approved_at: string | null;
  xml_generated_at: string | null;
  xml_file_url: string | null;
  filed_at: string | null;
  ros_acknowledgement: string | null;
  created_at: string;
  updated_at: string;
}

// Phase 7: Accountant Corrections & Learning

export interface AccountantCorrection {
  id: string;
  accountant_id: string;
  practice_id: string;
  client_user_id: string;
  accountant_client_id: string;
  vendor_pattern: string;
  transaction_description: string;
  original_category: string | null;
  original_category_id: string | null;
  corrected_category: string;
  corrected_category_id: string;
  original_vat_rate: number | null;
  corrected_vat_rate: number | null;
  client_industry: string | null;
  client_business_type: string | null;
  transaction_amount: number | null;
  transaction_type: string | null;
  correction_count: number;
  promoted_to_global: boolean;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorIntelligence {
  vendor_pattern: string;
  corrected_category: string;
  corrected_category_id: string;
  corrected_vat_rate: number | null;
  client_industry: string | null;
  accountant_count: number;
  total_corrections: number;
  confidence: number;
  last_updated: string;
}

// Phase 8: Inbound Email

export type InboundEmailStatus = 'pending' | 'triaging' | 'extracting' | 'enriching' | 'processed' | 'ignored' | 'failed' | 'unmatched';
export type TriageClassification = 'invoice' | 'receipt' | 'credit_note' | 'statement' | 'bank_notice' | 'personal' | 'spam' | 'newsletter' | 'other';
export type DocumentRoute = 'auto_filed' | 'pending_review' | 'accountant_queue';

export interface InboundEmail {
  id: string;
  accountant_client_id: string | null;
  client_user_id: string | null;
  practice_id: string | null;
  from_address: string;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  resend_email_id: string | null;
  status: InboundEmailStatus;
  triage_classification: TriageClassification | null;
  triage_confidence: number | null;
  attachment_count: number;
  attachment_paths: string[];
  extracted_data: Record<string, unknown> | null;
  extraction_confidence: number | null;
  matched_transaction_id: string | null;
  assigned_category: string | null;
  assigned_category_id: string | null;
  assigned_vat_rate: number | null;
  enrichment_confidence: number | null;
  route: DocumentRoute | null;
  receipt_id: string | null;
  document_hash: string | null;
  created_at: string;
  processed_at: string | null;
}

// Phase 8: Period-End Questionnaire

export type QuestionnaireStatus = 'pending' | 'sent' | 'started' | 'completed' | 'reviewed';

export interface PeriodEndQuestionnaire {
  id: string;
  accountant_client_id: string;
  client_user_id: string;
  accountant_id: string;
  period_type: 'vat_period' | 'year_end';
  period_start: string;
  period_end: string;
  status: QuestionnaireStatus;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  responses: QuestionnaireResponses;
  accountant_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionnaireResponses {
  new_assets_over_1000: boolean | null;
  new_assets_details: string | null;
  new_loans_or_finance: boolean | null;
  new_loans_details: string | null;
  staff_changes: boolean | null;
  staff_changes_details: string | null;
  personal_card_business_expenses: boolean | null;
  personal_card_details: string | null;
  income_outside_bank: boolean | null;
  income_outside_details: string | null;
  other_notes: string | null;
  _prefilled?: Record<string, unknown>;
}

// Phase 8: Notification

export type NotificationType = 'receipt_chase' | 'period_end_questionnaire' | 'document_request_reminder' | 'filing_ready' | 'filing_approved' | 'inbound_email_review' | 'general';

export interface Notification {
  id: string;
  recipient_user_id: string;
  recipient_email: string;
  notification_type: NotificationType;
  subject: string;
  body_html: string;
  scheduled_for: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  error_message: string | null;
  dedup_key: string | null;
  attempt_count: number;
  max_attempts: number;
  metadata: Record<string, unknown>;
  created_at: string;
}
