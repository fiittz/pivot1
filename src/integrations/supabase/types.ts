export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accountant_clients: {
        Row: {
          access_level: Database["public"]["Enums"]["client_access_level"]
          accountant_id: string
          client_business_name: string | null
          client_email: string
          client_name: string
          client_phone: string | null
          client_user_id: string | null
          created_at: string
          engagement_type: string | null
          fee_amount: number | null
          fee_frequency: string | null
          id: string
          inbound_email_code: string
          notes: string | null
          practice_id: string
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          updated_at: string
          year_end_month: number | null
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["client_access_level"]
          accountant_id: string
          client_business_name?: string | null
          client_email: string
          client_name: string
          client_phone?: string | null
          client_user_id?: string | null
          created_at?: string
          engagement_type?: string | null
          fee_amount?: number | null
          fee_frequency?: string | null
          id?: string
          inbound_email_code?: string
          notes?: string | null
          practice_id: string
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
          year_end_month?: number | null
        }
        Update: {
          access_level?: Database["public"]["Enums"]["client_access_level"]
          accountant_id?: string
          client_business_name?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string | null
          client_user_id?: string | null
          created_at?: string
          engagement_type?: string | null
          fee_amount?: number | null
          fee_frequency?: string | null
          id?: string
          inbound_email_code?: string
          notes?: string | null
          practice_id?: string
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          updated_at?: string
          year_end_month?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_clients_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "accountant_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_corrections: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          client_business_type: string | null
          client_industry: string | null
          client_user_id: string
          corrected_category: string
          corrected_category_id: string
          corrected_vat_rate: number | null
          correction_count: number
          created_at: string
          id: string
          original_category: string | null
          original_category_id: string | null
          original_vat_rate: number | null
          practice_id: string
          promoted_at: string | null
          promoted_to_global: boolean
          transaction_amount: number | null
          transaction_description: string
          transaction_type: string | null
          updated_at: string
          vendor_pattern: string
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          client_business_type?: string | null
          client_industry?: string | null
          client_user_id: string
          corrected_category: string
          corrected_category_id: string
          corrected_vat_rate?: number | null
          correction_count?: number
          created_at?: string
          id?: string
          original_category?: string | null
          original_category_id?: string | null
          original_vat_rate?: number | null
          practice_id: string
          promoted_at?: string | null
          promoted_to_global?: boolean
          transaction_amount?: number | null
          transaction_description: string
          transaction_type?: string | null
          updated_at?: string
          vendor_pattern: string
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          client_business_type?: string | null
          client_industry?: string | null
          client_user_id?: string
          corrected_category?: string
          corrected_category_id?: string
          corrected_vat_rate?: number | null
          correction_count?: number
          created_at?: string
          id?: string
          original_category?: string | null
          original_category_id?: string | null
          original_vat_rate?: number | null
          practice_id?: string
          promoted_at?: string | null
          promoted_to_global?: boolean
          transaction_amount?: number | null
          transaction_description?: string
          transaction_type?: string | null
          updated_at?: string
          vendor_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountant_corrections_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_corrections_corrected_category_id_fkey"
            columns: ["corrected_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_corrections_original_category_id_fkey"
            columns: ["original_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_corrections_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "accountant_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      accountant_practices: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          tax_agent_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          tax_agent_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          tax_agent_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_number: string | null
          account_type: string
          balance: number | null
          bic: string | null
          created_at: string | null
          currency: string | null
          iban: string | null
          id: string
          is_default: boolean | null
          name: string
          sort_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          account_type?: string
          balance?: number | null
          bic?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          sort_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          account_type?: string
          balance?: number | null
          bic?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          sort_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      approved_accountants: {
        Row: {
          approved_by: string | null
          created_at: string
          email: string
          id: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          email: string
          id?: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          email?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      approved_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      assistant_drafts: {
        Row: {
          approved_at: string | null
          body_html: string | null
          body_text: string
          created_at: string | null
          draft_type: string
          email_id: string | null
          id: string
          sent_at: string | null
          status: string | null
          subject: string
          telegram_message_id: string | null
          to_address: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          body_html?: string | null
          body_text: string
          created_at?: string | null
          draft_type: string
          email_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject: string
          telegram_message_id?: string | null
          to_address: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          body_html?: string | null
          body_text?: string
          created_at?: string | null
          draft_type?: string
          email_id?: string | null
          id?: string
          sent_at?: string | null
          status?: string | null
          subject?: string
          telegram_message_id?: string | null
          to_address?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_drafts_email_id"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "assistant_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_email_threads: {
        Row: {
          created_at: string | null
          email_count: number | null
          id: string
          last_email_at: string | null
          participants: string[] | null
          subject: string | null
          summary: string | null
          thread_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_count?: number | null
          id?: string
          last_email_at?: string | null
          participants?: string[] | null
          subject?: string | null
          summary?: string | null
          thread_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_count?: number | null
          id?: string
          last_email_at?: string | null
          participants?: string[] | null
          subject?: string | null
          summary?: string | null
          thread_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assistant_emails: {
        Row: {
          body_html: string | null
          body_text: string | null
          classification: string | null
          classification_reason: string | null
          created_at: string | null
          from_address: string
          from_name: string | null
          id: string
          is_read: boolean | null
          message_id: string
          raw_headers: Json | null
          received_at: string
          response_id: string | null
          response_status: string | null
          subject: string | null
          thread_id: string | null
          to_address: string | null
          updated_at: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          classification?: string | null
          classification_reason?: string | null
          created_at?: string | null
          from_address: string
          from_name?: string | null
          id?: string
          is_read?: boolean | null
          message_id: string
          raw_headers?: Json | null
          received_at: string
          response_id?: string | null
          response_status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          updated_at?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          classification?: string | null
          classification_reason?: string | null
          created_at?: string | null
          from_address?: string
          from_name?: string | null
          id?: string
          is_read?: boolean | null
          message_id?: string
          raw_headers?: Json | null
          received_at?: string
          response_id?: string | null
          response_status?: string | null
          subject?: string | null
          thread_id?: string | null
          to_address?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_emails_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "assistant_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_linkedin_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          linkedin_post_id: string | null
          posted_at: string | null
          status: string | null
          telegram_message_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          linkedin_post_id?: string | null
          posted_at?: string | null
          status?: string | null
          telegram_message_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          linkedin_post_id?: string | null
          posted_at?: string | null
          status?: string | null
          telegram_message_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      assistant_linkedin_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          linkedin_user_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          linkedin_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          linkedin_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_connections: {
        Row: {
          account_details: Json | null
          accounts: Json | null
          bank_name: string
          connected_at: string | null
          country: string
          created_at: string
          error_detail: string | null
          expires_at: string | null
          id: string
          last_synced_at: string | null
          session_id: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_details?: Json | null
          accounts?: Json | null
          bank_name: string
          connected_at?: string | null
          country?: string
          created_at?: string
          error_detail?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          session_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_details?: Json | null
          accounts?: Json | null
          bank_name?: string
          connected_at?: string | null
          country?: string
          created_at?: string
          error_detail?: string | null
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          session_id?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_settings: {
        Row: {
          available_days: number[]
          end_hour: number
          id: number
          lookahead_days: number
          rate_limit_per_hour: number
          reminder_10m_enabled: boolean
          reminder_1h_enabled: boolean
          reminder_24h_enabled: boolean
          same_day_buffer_hours: number
          slot_minutes: number
          start_hour: number
          updated_at: string | null
        }
        Insert: {
          available_days?: number[]
          end_hour?: number
          id?: number
          lookahead_days?: number
          rate_limit_per_hour?: number
          reminder_10m_enabled?: boolean
          reminder_1h_enabled?: boolean
          reminder_24h_enabled?: boolean
          same_day_buffer_hours?: number
          slot_minutes?: number
          start_hour?: number
          updated_at?: string | null
        }
        Update: {
          available_days?: number[]
          end_hour?: number
          id?: number
          lookahead_days?: number
          rate_limit_per_hour?: number
          reminder_10m_enabled?: boolean
          reminder_1h_enabled?: boolean
          reminder_24h_enabled?: boolean
          same_day_buffer_hours?: number
          slot_minutes?: number
          start_hour?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          account_code: string | null
          account_type: string
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          type: string | null
          user_id: string
          vat_rate: number | null
        }
        Insert: {
          account_code?: string | null
          account_type?: string
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          type?: string | null
          user_id: string
          vat_rate?: number | null
        }
        Update: {
          account_code?: string | null
          account_type?: string
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          type?: string | null
          user_id?: string
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          created_at: string
          expires_at: string
          id: string
          invite_email: string
          invite_token: string
          message: string | null
          practice_id: string
          status: Database["public"]["Enums"]["invite_status"]
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_email: string
          invite_token?: string
          message?: string | null
          practice_id: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invite_email?: string
          invite_token?: string
          message?: string | null
          practice_id?: string
          status?: Database["public"]["Enums"]["invite_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "accountant_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tasks: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          category: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_tasks_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_log: {
        Row: {
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          content: string | null
          created_at: string | null
          demo_booking_id: string | null
          id: string
          new_stage: Database["public"]["Enums"]["crm_stage"] | null
          old_stage: Database["public"]["Enums"]["crm_stage"] | null
          prospect_id: string
          title: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["crm_activity_type"]
          content?: string | null
          created_at?: string | null
          demo_booking_id?: string | null
          id?: string
          new_stage?: Database["public"]["Enums"]["crm_stage"] | null
          old_stage?: Database["public"]["Enums"]["crm_stage"] | null
          prospect_id: string
          title: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["crm_activity_type"]
          content?: string | null
          created_at?: string | null
          demo_booking_id?: string | null
          id?: string
          new_stage?: Database["public"]["Enums"]["crm_stage"] | null
          old_stage?: Database["public"]["Enums"]["crm_stage"] | null
          prospect_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_log_demo_booking_id_fkey"
            columns: ["demo_booking_id"]
            isOneToOne: false
            referencedRelation: "demo_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activity_log_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "crm_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_prospects: {
        Row: {
          area: string | null
          call_1_date: string | null
          call_1_notes: string | null
          call_2_date: string | null
          call_2_notes: string | null
          closed_date: string | null
          comments: string | null
          created_at: string | null
          deal_value: number | null
          demo_date: string | null
          demo_notes: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          pilot_started: string | null
          priority: Database["public"]["Enums"]["crm_priority"]
          stage: Database["public"]["Enums"]["crm_stage"]
          updated_at: string | null
          website: string | null
        }
        Insert: {
          area?: string | null
          call_1_date?: string | null
          call_1_notes?: string | null
          call_2_date?: string | null
          call_2_notes?: string | null
          closed_date?: string | null
          comments?: string | null
          created_at?: string | null
          deal_value?: number | null
          demo_date?: string | null
          demo_notes?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          pilot_started?: string | null
          priority?: Database["public"]["Enums"]["crm_priority"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          area?: string | null
          call_1_date?: string | null
          call_1_notes?: string | null
          call_2_date?: string | null
          call_2_notes?: string | null
          closed_date?: string | null
          comments?: string | null
          created_at?: string | null
          deal_value?: number | null
          demo_date?: string | null
          demo_notes?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          pilot_started?: string | null
          priority?: Database["public"]["Enums"]["crm_priority"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      demo_bookings: {
        Row: {
          cancelled: boolean
          confirmed: boolean
          created_at: string
          google_event_id: string | null
          id: string
          invitee_email: string
          invitee_name: string
          meeting_url: string | null
          reminder_10m_sent: boolean
          reminder_1h_sent: boolean
          reminder_24h_sent: boolean
          scheduled_at: string
          summary: string | null
        }
        Insert: {
          cancelled?: boolean
          confirmed?: boolean
          created_at?: string
          google_event_id?: string | null
          id?: string
          invitee_email: string
          invitee_name: string
          meeting_url?: string | null
          reminder_10m_sent?: boolean
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at: string
          summary?: string | null
        }
        Update: {
          cancelled?: boolean
          confirmed?: boolean
          created_at?: string
          google_event_id?: string | null
          id?: string
          invitee_email?: string
          invitee_name?: string
          meeting_url?: string | null
          reminder_10m_sent?: boolean
          reminder_1h_sent?: boolean
          reminder_24h_sent?: boolean
          scheduled_at?: string
          summary?: string | null
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          accountant_client_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
          sender_role: string
        }
        Insert: {
          accountant_client_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
          sender_role: string
        }
        Update: {
          accountant_client_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      director_onboarding: {
        Row: {
          annual_salary: number | null
          assessment_basis: string | null
          created_at: string | null
          date_of_birth: string | null
          director_name: string | null
          director_number: number
          estimated_dividends: number | null
          id: string
          marital_status: string | null
          onboarding_completed: boolean | null
          onboarding_data: Json | null
          pps_number: string | null
          receives_dividends: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          annual_salary?: number | null
          assessment_basis?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          director_name?: string | null
          director_number?: number
          estimated_dividends?: number | null
          id?: string
          marital_status?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          pps_number?: string | null
          receives_dividends?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          annual_salary?: number | null
          assessment_basis?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          director_name?: string | null
          director_number?: number
          estimated_dividends?: number | null
          id?: string
          marital_status?: string | null
          onboarding_completed?: boolean | null
          onboarding_data?: Json | null
          pps_number?: string | null
          receives_dividends?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_requests: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          category: string | null
          client_user_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["document_request_status"]
          title: string
          updated_at: string
          uploaded_file_url: string | null
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          category?: string | null
          client_user_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_request_status"]
          title: string
          updated_at?: string
          uploaded_file_url?: string | null
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          category?: string | null
          client_user_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["document_request_status"]
          title?: string
          updated_at?: string
          uploaded_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          receipt_url: string | null
          supplier_id: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          description: string
          expense_date: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      filing_records: {
        Row: {
          accountant_approved: boolean
          accountant_client_id: string
          accountant_id: string
          accountant_review_notes: string | null
          accountant_reviewed: boolean
          approved_at: string | null
          client_user_id: string
          created_at: string
          filed_at: string | null
          filing_type: Database["public"]["Enums"]["filing_type"]
          id: string
          questionnaire_snapshot: Json | null
          ros_acknowledgement: string | null
          status: Database["public"]["Enums"]["filing_status"]
          tax_period_end: string
          tax_period_start: string
          updated_at: string
          xml_file_url: string | null
          xml_generated_at: string | null
        }
        Insert: {
          accountant_approved?: boolean
          accountant_client_id: string
          accountant_id: string
          accountant_review_notes?: string | null
          accountant_reviewed?: boolean
          approved_at?: string | null
          client_user_id: string
          created_at?: string
          filed_at?: string | null
          filing_type: Database["public"]["Enums"]["filing_type"]
          id?: string
          questionnaire_snapshot?: Json | null
          ros_acknowledgement?: string | null
          status?: Database["public"]["Enums"]["filing_status"]
          tax_period_end: string
          tax_period_start: string
          updated_at?: string
          xml_file_url?: string | null
          xml_generated_at?: string | null
        }
        Update: {
          accountant_approved?: boolean
          accountant_client_id?: string
          accountant_id?: string
          accountant_review_notes?: string | null
          accountant_reviewed?: boolean
          approved_at?: string | null
          client_user_id?: string
          created_at?: string
          filed_at?: string | null
          filing_type?: Database["public"]["Enums"]["filing_type"]
          id?: string
          questionnaire_snapshot?: Json | null
          ros_acknowledgement?: string | null
          status?: Database["public"]["Enums"]["filing_status"]
          tax_period_end?: string
          tax_period_start?: string
          updated_at?: string
          xml_file_url?: string | null
          xml_generated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filing_records_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          account_id: string | null
          created_at: string | null
          filename: string | null
          id: string
          row_count: number | null
          status: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          filename?: string | null
          id?: string
          row_count?: number | null
          status?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          filename?: string | null
          id?: string
          row_count?: number | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_emails: {
        Row: {
          accountant_client_id: string | null
          assigned_category: string | null
          assigned_category_id: string | null
          assigned_vat_rate: number | null
          attachment_count: number | null
          attachment_paths: string[] | null
          body_text: string | null
          client_user_id: string | null
          created_at: string
          document_hash: string | null
          enrichment_confidence: number | null
          extracted_data: Json | null
          extraction_confidence: number | null
          from_address: string
          id: string
          matched_transaction_id: string | null
          practice_id: string | null
          processed_at: string | null
          receipt_id: string | null
          resend_email_id: string | null
          route: string | null
          status: string
          subject: string | null
          to_address: string
          triage_classification: string | null
          triage_confidence: number | null
        }
        Insert: {
          accountant_client_id?: string | null
          assigned_category?: string | null
          assigned_category_id?: string | null
          assigned_vat_rate?: number | null
          attachment_count?: number | null
          attachment_paths?: string[] | null
          body_text?: string | null
          client_user_id?: string | null
          created_at?: string
          document_hash?: string | null
          enrichment_confidence?: number | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          from_address: string
          id?: string
          matched_transaction_id?: string | null
          practice_id?: string | null
          processed_at?: string | null
          receipt_id?: string | null
          resend_email_id?: string | null
          route?: string | null
          status?: string
          subject?: string | null
          to_address: string
          triage_classification?: string | null
          triage_confidence?: number | null
        }
        Update: {
          accountant_client_id?: string | null
          assigned_category?: string | null
          assigned_category_id?: string | null
          assigned_vat_rate?: number | null
          attachment_count?: number | null
          attachment_paths?: string[] | null
          body_text?: string | null
          client_user_id?: string | null
          created_at?: string
          document_hash?: string | null
          enrichment_confidence?: number | null
          extracted_data?: Json | null
          extraction_confidence?: number | null
          from_address?: string
          id?: string
          matched_transaction_id?: string | null
          practice_id?: string | null
          processed_at?: string | null
          receipt_id?: string | null
          resend_email_id?: string | null
          route?: string | null
          status?: string
          subject?: string | null
          to_address?: string
          triage_classification?: string | null
          triage_confidence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_practice_id_fkey"
            columns: ["practice_id"]
            isOneToOne: false
            referencedRelation: "accountant_practices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          account_id: string | null
          created_at: string | null
          customer_address: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_tax_number: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type: string | null
          line_items: Json | null
          notes: string | null
          rct_amount: number | null
          rct_enabled: boolean | null
          rct_rate: number | null
          status: string | null
          subtotal: number | null
          supply_date: string | null
          total: number | null
          transaction_id: string | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_tax_number?: string | null
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_number: string
          invoice_type?: string | null
          line_items?: Json | null
          notes?: string | null
          rct_amount?: number | null
          rct_enabled?: boolean | null
          rct_rate?: number | null
          status?: string | null
          subtotal?: number | null
          supply_date?: string | null
          total?: number | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_tax_number?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string | null
          line_items?: Json | null
          notes?: string | null
          rct_amount?: number | null
          rct_enabled?: boolean | null
          rct_rate?: number | null
          status?: string | null
          subtotal?: number | null
          supply_date?: string | null
          total?: number | null
          transaction_id?: string | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_prep_crm: {
        Row: {
          company: string
          contact_name: string | null
          created_at: string | null
          deal_value: string | null
          domain: string | null
          id: number
          last_contact: string | null
          notes: string | null
          stage: string | null
          title: string | null
        }
        Insert: {
          company?: string
          contact_name?: string | null
          created_at?: string | null
          deal_value?: string | null
          domain?: string | null
          id?: never
          last_contact?: string | null
          notes?: string | null
          stage?: string | null
          title?: string | null
        }
        Update: {
          company?: string
          contact_name?: string | null
          created_at?: string | null
          deal_value?: string | null
          domain?: string | null
          id?: never
          last_contact?: string | null
          notes?: string | null
          stage?: string | null
          title?: string | null
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          attempt_count: number
          body_html: string
          created_at: string
          dedup_key: string | null
          error_message: string | null
          id: string
          max_attempts: number
          metadata: Json | null
          notification_type: string
          recipient_email: string
          recipient_user_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          attempt_count?: number
          body_html: string
          created_at?: string
          dedup_key?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json | null
          notification_type: string
          recipient_email: string
          recipient_user_id: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          attempt_count?: number
          body_html?: string
          created_at?: string
          dedup_key?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          metadata?: Json | null
          notification_type?: string
          recipient_email?: string
          recipient_user_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      onboarding_settings: {
        Row: {
          accountant_email: string | null
          accountant_permissions: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          buys_from_non_eu: boolean | null
          buys_goods_from_eu: boolean | null
          buys_services_from_eu: boolean | null
          category_rules: Json | null
          completed_at: string | null
          created_at: string
          employee_count: number | null
          eu_trade_enabled: boolean | null
          expense_types: string[] | null
          has_employees: boolean | null
          has_section_56_authorisation: boolean | null
          id: string
          income_streams: string[] | null
          industry: string | null
          invite_accountant: boolean | null
          invoicing: boolean | null
          ocr_required: boolean | null
          onboarding_completed: boolean | null
          payment_terms: string | null
          payroll_frequency: string | null
          receipt_upload_method: string | null
          sells: string | null
          sells_digital_services_b2c: boolean | null
          sells_goods_to_eu: boolean | null
          sells_services_to_eu: boolean | null
          sells_to_non_eu: boolean | null
          transaction_sources: string[] | null
          updated_at: string
          user_id: string
          uses_postponed_accounting: boolean | null
          uses_subcontractors: boolean | null
          vat_basis: string | null
          vat_frequency: string | null
          vat_number: string | null
          vat_rates_used: string[] | null
          vat_registered: boolean | null
          year_end: string | null
        }
        Insert: {
          accountant_email?: string | null
          accountant_permissions?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          buys_from_non_eu?: boolean | null
          buys_goods_from_eu?: boolean | null
          buys_services_from_eu?: boolean | null
          category_rules?: Json | null
          completed_at?: string | null
          created_at?: string
          employee_count?: number | null
          eu_trade_enabled?: boolean | null
          expense_types?: string[] | null
          has_employees?: boolean | null
          has_section_56_authorisation?: boolean | null
          id?: string
          income_streams?: string[] | null
          industry?: string | null
          invite_accountant?: boolean | null
          invoicing?: boolean | null
          ocr_required?: boolean | null
          onboarding_completed?: boolean | null
          payment_terms?: string | null
          payroll_frequency?: string | null
          receipt_upload_method?: string | null
          sells?: string | null
          sells_digital_services_b2c?: boolean | null
          sells_goods_to_eu?: boolean | null
          sells_services_to_eu?: boolean | null
          sells_to_non_eu?: boolean | null
          transaction_sources?: string[] | null
          updated_at?: string
          user_id: string
          uses_postponed_accounting?: boolean | null
          uses_subcontractors?: boolean | null
          vat_basis?: string | null
          vat_frequency?: string | null
          vat_number?: string | null
          vat_rates_used?: string[] | null
          vat_registered?: boolean | null
          year_end?: string | null
        }
        Update: {
          accountant_email?: string | null
          accountant_permissions?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          buys_from_non_eu?: boolean | null
          buys_goods_from_eu?: boolean | null
          buys_services_from_eu?: boolean | null
          category_rules?: Json | null
          completed_at?: string | null
          created_at?: string
          employee_count?: number | null
          eu_trade_enabled?: boolean | null
          expense_types?: string[] | null
          has_employees?: boolean | null
          has_section_56_authorisation?: boolean | null
          id?: string
          income_streams?: string[] | null
          industry?: string | null
          invite_accountant?: boolean | null
          invoicing?: boolean | null
          ocr_required?: boolean | null
          onboarding_completed?: boolean | null
          payment_terms?: string | null
          payroll_frequency?: string | null
          receipt_upload_method?: string | null
          sells?: string | null
          sells_digital_services_b2c?: boolean | null
          sells_goods_to_eu?: boolean | null
          sells_services_to_eu?: boolean | null
          sells_to_non_eu?: boolean | null
          transaction_sources?: string[] | null
          updated_at?: string
          user_id?: string
          uses_postponed_accounting?: boolean | null
          uses_subcontractors?: boolean | null
          vat_basis?: string | null
          vat_frequency?: string | null
          vat_number?: string | null
          vat_rates_used?: string[] | null
          vat_registered?: boolean | null
          year_end?: string | null
        }
        Relationships: []
      }
      period_end_questionnaires: {
        Row: {
          accountant_client_id: string
          accountant_id: string
          accountant_notes: string | null
          client_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          responses: Json | null
          reviewed_at: string | null
          sent_at: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accountant_client_id: string
          accountant_id: string
          accountant_notes?: string | null
          client_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          responses?: Json | null
          reviewed_at?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accountant_client_id?: string
          accountant_id?: string
          accountant_notes?: string | null
          client_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          responses?: Json | null
          reviewed_at?: string | null
          sent_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_end_questionnaires_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_items: number
          id: string
          input_data: Json | null
          job_type: string
          processed_items: number
          result_data: Json | null
          started_at: string | null
          status: string
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          input_data?: Json | null
          job_type: string
          processed_items?: number
          result_data?: Json | null
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_items?: number
          id?: string
          input_data?: Json | null
          job_type?: string
          processed_items?: number
          result_data?: Json | null
          started_at?: string | null
          status?: string
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          backup_email: string | null
          business_description: string | null
          business_name: string | null
          business_type: Database["public"]["Enums"]["business_type"] | null
          created_at: string
          dashboard_widget_preferences: Json | null
          email: string | null
          id: string
          phone: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          backup_email?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          dashboard_widget_preferences?: Json | null
          email?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          backup_email?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: Database["public"]["Enums"]["business_type"] | null
          created_at?: string
          dashboard_widget_preferences?: Json | null
          email?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      receipt_chase_log: {
        Row: {
          accountant_client_id: string | null
          chase_number: number
          client_user_id: string
          created_at: string
          escalated_to_accountant: boolean
          id: string
          notification_id: string | null
          transaction_id: string
        }
        Insert: {
          accountant_client_id?: string | null
          chase_number?: number
          client_user_id: string
          created_at?: string
          escalated_to_accountant?: boolean
          id?: string
          notification_id?: string | null
          transaction_id: string
        }
        Update: {
          accountant_client_id?: string | null
          chase_number?: number
          client_user_id?: string
          created_at?: string
          escalated_to_accountant?: boolean
          id?: string
          notification_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_chase_log_accountant_client_id_fkey"
            columns: ["accountant_client_id"]
            isOneToOne: false
            referencedRelation: "accountant_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_chase_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notification_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number | null
          created_at: string | null
          expense_id: string | null
          id: string
          image_url: string
          ocr_data: Json | null
          receipt_date: string | null
          transaction_id: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
          vendor_name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          expense_id?: string | null
          id?: string
          image_url: string
          ocr_data?: Json | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          expense_id?: string | null
          id?: string
          image_url?: string
          ocr_data?: Json | null
          receipt_date?: string | null
          transaction_id?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string | null
          default_category_id: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          default_category_id?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          default_category_id?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_default_category_id_fkey"
            columns: ["default_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          bank_connection_id: string | null
          bank_transaction_id: string | null
          category_id: string | null
          created_at: string | null
          description: string
          id: string
          import_batch_id: string | null
          is_reconciled: boolean | null
          mcc_code: number | null
          notes: string | null
          receipt_url: string | null
          reference: string | null
          transaction_date: string
          type: string | null
          updated_at: string | null
          user_id: string
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          bank_connection_id?: string | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          mcc_code?: number | null
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          transaction_date: string
          type?: string | null
          updated_at?: string | null
          user_id: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          bank_connection_id?: string | null
          bank_transaction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_batch_id?: string | null
          is_reconciled?: boolean | null
          mcc_code?: number | null
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          transaction_date?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_bank_connection_id_fkey"
            columns: ["bank_connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_corrections: {
        Row: {
          corrected_category: string
          corrected_category_id: string
          corrected_vat_rate: number | null
          created_at: string | null
          id: string
          original_category: string | null
          promoted_to_cache: boolean | null
          transaction_count: number | null
          user_id: string
          vendor_pattern: string
        }
        Insert: {
          corrected_category: string
          corrected_category_id: string
          corrected_vat_rate?: number | null
          created_at?: string | null
          id?: string
          original_category?: string | null
          promoted_to_cache?: boolean | null
          transaction_count?: number | null
          user_id: string
          vendor_pattern: string
        }
        Update: {
          corrected_category?: string
          corrected_category_id?: string
          corrected_vat_rate?: number | null
          created_at?: string | null
          id?: string
          original_category?: string | null
          promoted_to_cache?: boolean | null
          transaction_count?: number | null
          user_id?: string
          vendor_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_corrections_corrected_category_id_fkey"
            columns: ["corrected_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role_type"]
          user_id?: string
        }
        Relationships: []
      }
      vat_returns: {
        Row: {
          all_expenses_added: boolean | null
          all_sales_added: boolean | null
          completed_at: string | null
          confirm_accuracy: boolean | null
          created_at: string | null
          credit_notes: boolean | null
          credit_notes_details: string | null
          declaration_penalties_understood: boolean | null
          declaration_period_lock_understood: boolean | null
          declaration_true_and_complete: boolean | null
          eu_purchase_ids: string | null
          eu_purchases: boolean | null
          food_vat_claim: string | null
          id: string
          late_transactions: boolean | null
          lock_period: boolean | null
          manual_adjustment_amount: number | null
          manual_adjustment_reason: string | null
          manual_adjustments: boolean | null
          missing_receipts: boolean | null
          missing_receipts_list: string | null
          motor_vat_claim: string | null
          non_eu_purchase_details: string | null
          non_eu_purchases: boolean | null
          period_end: string
          period_start: string
          purchases_total: number | null
          remove_non_allowed_reason: string | null
          remove_non_allowed_vat: boolean | null
          reviewed_flagged_transactions: boolean | null
          sales_total: number | null
          special_sales: boolean | null
          special_sales_notes: string | null
          status: string | null
          unpaid_invoices: boolean | null
          unpaid_invoices_list: string | null
          updated_at: string | null
          user_id: string
          vat_due: number | null
          vat_notes: string | null
          vat_on_purchases: number | null
          vat_on_sales: number | null
        }
        Insert: {
          all_expenses_added?: boolean | null
          all_sales_added?: boolean | null
          completed_at?: string | null
          confirm_accuracy?: boolean | null
          created_at?: string | null
          credit_notes?: boolean | null
          credit_notes_details?: string | null
          declaration_penalties_understood?: boolean | null
          declaration_period_lock_understood?: boolean | null
          declaration_true_and_complete?: boolean | null
          eu_purchase_ids?: string | null
          eu_purchases?: boolean | null
          food_vat_claim?: string | null
          id?: string
          late_transactions?: boolean | null
          lock_period?: boolean | null
          manual_adjustment_amount?: number | null
          manual_adjustment_reason?: string | null
          manual_adjustments?: boolean | null
          missing_receipts?: boolean | null
          missing_receipts_list?: string | null
          motor_vat_claim?: string | null
          non_eu_purchase_details?: string | null
          non_eu_purchases?: boolean | null
          period_end: string
          period_start: string
          purchases_total?: number | null
          remove_non_allowed_reason?: string | null
          remove_non_allowed_vat?: boolean | null
          reviewed_flagged_transactions?: boolean | null
          sales_total?: number | null
          special_sales?: boolean | null
          special_sales_notes?: string | null
          status?: string | null
          unpaid_invoices?: boolean | null
          unpaid_invoices_list?: string | null
          updated_at?: string | null
          user_id: string
          vat_due?: number | null
          vat_notes?: string | null
          vat_on_purchases?: number | null
          vat_on_sales?: number | null
        }
        Update: {
          all_expenses_added?: boolean | null
          all_sales_added?: boolean | null
          completed_at?: string | null
          confirm_accuracy?: boolean | null
          created_at?: string | null
          credit_notes?: boolean | null
          credit_notes_details?: string | null
          declaration_penalties_understood?: boolean | null
          declaration_period_lock_understood?: boolean | null
          declaration_true_and_complete?: boolean | null
          eu_purchase_ids?: string | null
          eu_purchases?: boolean | null
          food_vat_claim?: string | null
          id?: string
          late_transactions?: boolean | null
          lock_period?: boolean | null
          manual_adjustment_amount?: number | null
          manual_adjustment_reason?: string | null
          manual_adjustments?: boolean | null
          missing_receipts?: boolean | null
          missing_receipts_list?: string | null
          motor_vat_claim?: string | null
          non_eu_purchase_details?: string | null
          non_eu_purchases?: boolean | null
          period_end?: string
          period_start?: string
          purchases_total?: number | null
          remove_non_allowed_reason?: string | null
          remove_non_allowed_vat?: boolean | null
          reviewed_flagged_transactions?: boolean | null
          sales_total?: number | null
          special_sales?: boolean | null
          special_sales_notes?: string | null
          status?: string | null
          unpaid_invoices?: boolean | null
          unpaid_invoices_list?: string | null
          updated_at?: string | null
          user_id?: string
          vat_due?: number | null
          vat_notes?: string | null
          vat_on_purchases?: number | null
          vat_on_sales?: number | null
        }
        Relationships: []
      }
      vendor_aggregates: {
        Row: {
          id: string
          last_aggregated: string | null
          top_category: string
          top_category_percentage: number | null
          total_transactions: number | null
          total_users: number | null
          vendor_pattern: string
        }
        Insert: {
          id?: string
          last_aggregated?: string | null
          top_category: string
          top_category_percentage?: number | null
          total_transactions?: number | null
          total_users?: number | null
          vendor_pattern: string
        }
        Update: {
          id?: string
          last_aggregated?: string | null
          top_category?: string
          top_category_percentage?: number | null
          total_transactions?: number | null
          total_users?: number | null
          vendor_pattern?: string
        }
        Relationships: []
      }
      vendor_cache: {
        Row: {
          business_purpose: string | null
          category: string
          confidence: number
          created_at: string | null
          hit_count: number | null
          id: string
          last_seen: string | null
          mcc_code: number | null
          normalized_name: string
          sector: string | null
          source: string
          user_id: string | null
          vat_deductible: boolean
          vat_type: string
          vendor_pattern: string
        }
        Insert: {
          business_purpose?: string | null
          category: string
          confidence?: number
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_seen?: string | null
          mcc_code?: number | null
          normalized_name: string
          sector?: string | null
          source?: string
          user_id?: string | null
          vat_deductible?: boolean
          vat_type: string
          vendor_pattern: string
        }
        Update: {
          business_purpose?: string | null
          category?: string
          confidence?: number
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_seen?: string | null
          mcc_code?: number | null
          normalized_name?: string
          sector?: string | null
          source?: string
          user_id?: string | null
          vat_deductible?: boolean
          vat_type?: string
          vendor_pattern?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          source: string | null
          unsubscribed: boolean | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          source?: string | null
          unsubscribed?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          source?: string | null
          unsubscribed?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      vendor_intelligence: {
        Row: {
          accountant_count: number | null
          client_industry: string | null
          confidence: number | null
          corrected_category: string | null
          corrected_category_id: string | null
          corrected_vat_rate: number | null
          last_updated: string | null
          total_corrections: number | null
          vendor_pattern: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_corrections_corrected_category_id_fkey"
            columns: ["corrected_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_add_approved_accountant: {
        Args: { p_email: string }
        Returns: {
          approved_by: string
          created_at: string
          email: string
          id: string
          status: string
        }[]
      }
      admin_list_approved_accountants: {
        Args: never
        Returns: {
          approved_by: string
          created_at: string
          email: string
          id: string
          status: string
        }[]
      }
      admin_revoke_approved_accountant: {
        Args: { p_id: string }
        Returns: undefined
      }
      aggregate_vendor_categories: { Args: never; Returns: undefined }
      calculate_vat: {
        Args: {
          p_total: number
          p_vat_rate: Database["public"]["Enums"]["vat_rate"]
        }
        Returns: {
          net_amount: number
          vat_amount: number
        }[]
      }
      crm_stage_order: {
        Args: { s: Database["public"]["Enums"]["crm_stage"] }
        Returns: number
      }
      generate_invoice_number: { Args: { p_user_id: string }; Returns: string }
      get_accountant_clients: {
        Args: { p_accountant_id: string }
        Returns: {
          business_name: string
          client_id: string
          email: string
          signed_up_at: string
          transaction_count: number
        }[]
      }
      get_platform_overview: {
        Args: never
        Returns: {
          active_accountants: number
          businesses_with_transactions: number
          suspended_accountants: number
          total_transactions: number
          total_users: number
          whitelisted_emails: number
        }[]
      }
      get_registered_accountants: {
        Args: never
        Returns: {
          client_count: number
          display_name: string
          email: string
          signed_up_at: string
          status: string
          user_id: string
        }[]
      }
      is_accountant_for: { Args: { target_user_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      promote_accountant_corrections: { Args: never; Returns: number }
      reactivate_accountant: { Args: { p_email: string }; Returns: undefined }
      suspend_accountant: { Args: { p_email: string }; Returns: undefined }
    }
    Enums: {
      audit_action:
        | "auto_categorized"
        | "vat_applied"
        | "rct_applied"
        | "matched_receipt"
        | "matched_transaction"
        | "duplicate_detected"
        | "anomaly_flagged"
        | "user_override"
      business_type:
        | "construction"
        | "carpentry_joinery"
        | "electrical"
        | "plumbing_heating"
        | "landscaping_groundworks"
        | "painting_decorating"
        | "manufacturing"
        | "retail_ecommerce"
        | "hospitality"
        | "professional_services"
        | "transport_logistics"
        | "health_wellness"
        | "technology_it"
        | "real_estate_property"
        | "maintenance_facilities"
      client_access_level: "read_only" | "read_write" | "full"
      client_status: "pending_invite" | "active" | "suspended" | "archived"
      crm_activity_type:
        | "note"
        | "call"
        | "email_sent"
        | "demo_booked"
        | "demo_confirmed"
        | "demo_done"
        | "stage_change"
        | "follow_up"
        | "system"
      crm_priority: "top" | "high" | "medium" | "low"
      crm_stage:
        | "new_lead"
        | "contacted"
        | "call_1_booked"
        | "call_1_done"
        | "demo_booked"
        | "demo_done"
        | "call_2_booked"
        | "call_2_done"
        | "pilot"
        | "closed_won"
        | "closed_lost"
        | "not_a_fit"
      document_request_status: "pending" | "uploaded" | "accepted" | "rejected"
      expense_status: "pending" | "approved" | "paid" | "rejected"
      filing_status:
        | "draft"
        | "in_review"
        | "approved"
        | "filed"
        | "acknowledged"
      filing_type:
        | "ct1"
        | "form11"
        | "vat3"
        | "rct_monthly"
        | "b1"
        | "annual_return"
      invite_status: "pending" | "accepted" | "expired" | "cancelled"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      rct_contract_status: "active" | "completed" | "cancelled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
      transaction_type: "income" | "expense"
      user_role_type: "owner" | "accountant" | "platform_admin"
      vat_rate:
        | "standard_23"
        | "reduced_13_5"
        | "second_reduced_9"
        | "livestock_4_8"
        | "zero_rated"
        | "exempt"
      vat_return_status: "draft" | "ready" | "submitted" | "paid"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        "auto_categorized",
        "vat_applied",
        "rct_applied",
        "matched_receipt",
        "matched_transaction",
        "duplicate_detected",
        "anomaly_flagged",
        "user_override",
      ],
      business_type: [
        "construction",
        "carpentry_joinery",
        "electrical",
        "plumbing_heating",
        "landscaping_groundworks",
        "painting_decorating",
        "manufacturing",
        "retail_ecommerce",
        "hospitality",
        "professional_services",
        "transport_logistics",
        "health_wellness",
        "technology_it",
        "real_estate_property",
        "maintenance_facilities",
      ],
      client_access_level: ["read_only", "read_write", "full"],
      client_status: ["pending_invite", "active", "suspended", "archived"],
      crm_activity_type: [
        "note",
        "call",
        "email_sent",
        "demo_booked",
        "demo_confirmed",
        "demo_done",
        "stage_change",
        "follow_up",
        "system",
      ],
      crm_priority: ["top", "high", "medium", "low"],
      crm_stage: [
        "new_lead",
        "contacted",
        "call_1_booked",
        "call_1_done",
        "demo_booked",
        "demo_done",
        "call_2_booked",
        "call_2_done",
        "pilot",
        "closed_won",
        "closed_lost",
        "not_a_fit",
      ],
      document_request_status: ["pending", "uploaded", "accepted", "rejected"],
      expense_status: ["pending", "approved", "paid", "rejected"],
      filing_status: [
        "draft",
        "in_review",
        "approved",
        "filed",
        "acknowledged",
      ],
      filing_type: [
        "ct1",
        "form11",
        "vat3",
        "rct_monthly",
        "b1",
        "annual_return",
      ],
      invite_status: ["pending", "accepted", "expired", "cancelled"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      rct_contract_status: ["active", "completed", "cancelled"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
      transaction_type: ["income", "expense"],
      user_role_type: ["owner", "accountant", "platform_admin"],
      vat_rate: [
        "standard_23",
        "reduced_13_5",
        "second_reduced_9",
        "livestock_4_8",
        "zero_rated",
        "exempt",
      ],
      vat_return_status: ["draft", "ready", "submitted", "paid"],
    },
  },
} as const
