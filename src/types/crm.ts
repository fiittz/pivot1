// CRM Types

export type CrmStage =
  | "new_lead" | "contacted" | "call_1_booked" | "call_1_done"
  | "demo_booked" | "demo_done" | "call_2_booked" | "call_2_done"
  | "pilot" | "closed_won" | "closed_lost" | "not_a_fit";

export type CrmPriority = "top" | "high" | "medium" | "low";

export type CrmActivityType =
  | "note" | "call" | "email_sent" | "demo_booked" | "demo_confirmed"
  | "demo_done" | "stage_change" | "follow_up" | "system";

export interface CrmProspect {
  id: string;
  name: string;
  contact_name: string | null;
  area: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  priority: CrmPriority;
  stage: CrmStage;
  comments: string | null;
  deal_value: number | null;
  call_1_date: string | null;
  call_1_notes: string | null;
  demo_date: string | null;
  demo_notes: string | null;
  call_2_date: string | null;
  call_2_notes: string | null;
  pilot_started: string | null;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivityLog {
  id: string;
  prospect_id: string;
  activity_type: CrmActivityType;
  title: string;
  content: string | null;
  old_stage: CrmStage | null;
  new_stage: CrmStage | null;
  demo_booking_id: string | null;
  created_at: string;
}

export interface DemoBooking {
  id: string;
  invitee_name: string;
  invitee_email: string;
  scheduled_at: string;
  google_event_id: string | null;
  meeting_url: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  reminder_10m_sent: boolean;
  confirmed: boolean;
  cancelled: boolean;
  created_at: string;
}

export interface CalendarSettings {
  id: number;
  start_hour: number;
  end_hour: number;
  slot_minutes: number;
  lookahead_days: number;
  same_day_buffer_hours: number;
  available_days: number[];
  rate_limit_per_hour: number;
  reminder_24h_enabled: boolean;
  reminder_1h_enabled: boolean;
  reminder_10m_enabled: boolean;
  updated_at: string;
}

// Display constants

export const STAGE_LABELS: Record<CrmStage, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  call_1_booked: "Call 1 Booked",
  call_1_done: "Call 1 Done",
  demo_booked: "Demo Booked",
  demo_done: "Demo Done",
  call_2_booked: "Call 2 Booked",
  call_2_done: "Call 2 Done",
  pilot: "Pilot",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  not_a_fit: "Not a Fit",
};

export const STAGE_ORDER: CrmStage[] = [
  "new_lead", "contacted", "call_1_booked", "call_1_done",
  "demo_booked", "demo_done", "call_2_booked", "call_2_done",
  "pilot", "closed_won", "closed_lost", "not_a_fit",
];

export const PRIORITY_LABELS: Record<CrmPriority, string> = {
  top: "TOP",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_COLORS: Record<CrmPriority, string> = {
  top: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-green-500 text-white",
  low: "bg-gray-400 text-white",
};

export const ACTIVITY_TYPE_LABELS: Record<CrmActivityType, string> = {
  note: "Note",
  call: "Call",
  email_sent: "Email Sent",
  demo_booked: "Demo Booked",
  demo_confirmed: "Demo Confirmed",
  demo_done: "Demo Done",
  stage_change: "Stage Change",
  follow_up: "Follow Up",
  system: "System",
};
