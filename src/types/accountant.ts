// Accountant domain types — Phase 1+

export type UserRoleType = 'owner' | 'accountant';

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
