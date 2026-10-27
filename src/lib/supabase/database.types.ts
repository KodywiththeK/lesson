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
    PostgrestVersion: "14.15"
  }
  private: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_academy_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["academy_member_role"][]
          target_academy_id: string
        }
        Returns: boolean
      }
      is_academy_creator: {
        Args: { target_academy_id: string }
        Returns: boolean
      }
      is_active_academy_member: {
        Args: { target_academy_id: string }
        Returns: boolean
      }
      is_teacher_record_member: {
        Args: { target_member_id: string }
        Returns: boolean
      }
      teacher_can_access_student: {
        Args: { target_academy_id: string; target_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_resolutions: {
        Row: {
          academy_id: string
          attendance_record_id: string
          confirmed_at: string
          confirmed_by: string | null
          created_at: string
          id: string
          lesson_event_id: string
          makeup_lesson_event_id: string | null
          reason: string
          resolved_as: string
          student_id: string
        }
        Insert: {
          academy_id: string
          attendance_record_id: string
          confirmed_at: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          lesson_event_id: string
          makeup_lesson_event_id?: string | null
          reason: string
          resolved_as: string
          student_id: string
        }
        Update: {
          academy_id?: string
          attendance_record_id?: string
          confirmed_at?: string
          confirmed_by?: string | null
          created_at?: string
          id?: string
          lesson_event_id?: string
          makeup_lesson_event_id?: string | null
          reason?: string
          resolved_as?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_resolutions_academy_attendance_record_fk"
            columns: ["academy_id", "attendance_record_id"]
            isOneToOne: true
            referencedRelation: "attendance_records"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "absence_resolutions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_academy_lesson_event_fk"
            columns: ["academy_id", "lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "absence_resolutions_academy_makeup_lesson_event_fk"
            columns: ["academy_id", "makeup_lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "absence_resolutions_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "absence_resolutions_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_lesson_event_id_fkey"
            columns: ["lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_makeup_lesson_event_id_fkey"
            columns: ["makeup_lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_resolutions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      academies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_members: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["academy_member_role"]
          status: Database["public"]["Enums"]["academy_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["academy_member_role"]
          status?: Database["public"]["Enums"]["academy_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["academy_member_role"]
          status?: Database["public"]["Enums"]["academy_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_members_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          absence_reason: string | null
          academy_id: string
          created_at: string
          id: string
          lesson_event_id: string
          marked_at: string
          marked_by: string | null
          status: string
          student_id: string
        }
        Insert: {
          absence_reason?: string | null
          academy_id: string
          created_at?: string
          id?: string
          lesson_event_id: string
          marked_at?: string
          marked_by?: string | null
          status: string
          student_id: string
        }
        Update: {
          absence_reason?: string | null
          academy_id?: string
          created_at?: string
          id?: string
          lesson_event_id?: string
          marked_at?: string
          marked_by?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_academy_lesson_event_fk"
            columns: ["academy_id", "lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "attendance_records_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "attendance_records_lesson_event_id_fkey"
            columns: ["lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          academy_id: string
          actor_id: string | null
          entity_id: string
          entity_table: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          reason: string | null
        }
        Insert: {
          academy_id: string
          actor_id?: string | null
          entity_id: string
          entity_table: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
        }
        Update: {
          academy_id?: string
          actor_id?: string | null
          entity_id?: string
          entity_table?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_inventory_batches: {
        Row: {
          academy_id: string
          book_id: string
          created_at: string
          created_by: string | null
          id: string
          ordered_on: string
          quantity: number
          stocked_at: string
        }
        Insert: {
          academy_id: string
          book_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordered_on: string
          quantity: number
          stocked_at: string
        }
        Update: {
          academy_id?: string
          book_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordered_on?: string
          quantity?: number
          stocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_inventory_batches_academy_book_fk"
            columns: ["academy_id", "book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "book_inventory_batches_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_inventory_batches_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_inventory_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_releases: {
        Row: {
          academy_id: string
          book_id: string
          book_title: string
          created_at: string
          created_by: string | null
          id: string
          paid_at: string | null
          price: number
          shipped_at: string
          status: string
          student_id: string
          student_name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          book_id: string
          book_title: string
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at?: string | null
          price: number
          shipped_at: string
          status?: string
          student_id: string
          student_name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          book_id?: string
          book_title?: string
          created_at?: string
          created_by?: string | null
          id?: string
          paid_at?: string | null
          price?: number
          shipped_at?: string
          status?: string
          student_id?: string
          student_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_releases_academy_book_fk"
            columns: ["academy_id", "book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "book_releases_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_releases_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "book_releases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_releases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_releases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          academy_id: string
          active: boolean
          created_at: string
          id: string
          price: number
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          id?: string
          price: number
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          id?: string
          price?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_income_snapshots: {
        Row: {
          academy_id: string
          amount: number
          created_at: string
          id: string
          instrument_id: string
          instrument_name: string
          discount_label: string | null
          discount_total: number
          due_on: string
          lesson_fee: number
          month: string
          paid_at: string | null
          paid_ledger_entry_id: string | null
          progress: string
          status: string
          student_id: string
          student_instrument_id: string | null
          student_name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          amount: number
          created_at?: string
          id?: string
          instrument_id: string
          instrument_name: string
          discount_label?: string | null
          discount_total?: number
          due_on: string
          lesson_fee?: number
          month: string
          paid_at?: string | null
          paid_ledger_entry_id?: string | null
          progress?: string
          status?: string
          student_id: string
          student_instrument_id?: string | null
          student_name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          amount?: number
          created_at?: string
          id?: string
          instrument_id?: string
          instrument_name?: string
          discount_label?: string | null
          discount_total?: number
          due_on?: string
          lesson_fee?: number
          month?: string
          paid_at?: string | null
          paid_ledger_entry_id?: string | null
          progress?: string
          status?: string
          student_id?: string
          student_instrument_id?: string | null
          student_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_income_snapshots_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_income_snapshots_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "fixed_income_snapshots_academy_student_instrument_fk"
            columns: ["academy_id", "student_instrument_id"]
            isOneToOne: false
            referencedRelation: "student_instruments"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "fixed_income_snapshots_paid_ledger_fk"
            columns: ["academy_id", "paid_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "fixed_income_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_income_snapshots_student_instrument_id_fkey"
            columns: ["student_instrument_id"]
            isOneToOne: false
            referencedRelation: "student_instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          academy_id: string
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          occurred_on: string
          ref_id: string | null
          ref_table: string | null
          source: Database["public"]["Enums"]["ledger_entry_source"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academy_id: string
          amount: number
          category?: string
          created_at?: string
          created_by?: string | null
          description: string
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          occurred_on: string
          ref_id?: string | null
          ref_table?: string | null
          source: Database["public"]["Enums"]["ledger_entry_source"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academy_id?: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          occurred_on?: string
          ref_id?: string | null
          ref_table?: string | null
          source?: Database["public"]["Enums"]["ledger_entry_source"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_calendar_memos: {
        Row: {
          academy_id: string
          content: string
          created_at: string
          id: string
          lesson_kind: string
          memo_date: string
          student_id: string | null
          student_name: string | null
          teacher_id: string | null
          teacher_name: string | null
          unread: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academy_id: string
          content?: string
          created_at?: string
          id?: string
          lesson_kind: string
          memo_date: string
          student_id?: string | null
          student_name?: string | null
          teacher_id?: string | null
          teacher_name?: string | null
          unread?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academy_id?: string
          content?: string
          created_at?: string
          id?: string
          lesson_kind?: string
          memo_date?: string
          student_id?: string | null
          student_name?: string | null
          teacher_id?: string | null
          teacher_name?: string | null
          unread?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_calendar_memos_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_calendar_memos_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_calendar_memos_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_calendar_memos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_events: {
        Row: {
          academy_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          ends_at: string
          generated_from_enrollment: boolean
          id: string
          instrument_id: string
          instrument_name: string
          lesson_kind: string
          starts_at: string
          status: string
          student_id: string
          student_instrument_id: string | null
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          ends_at: string
          generated_from_enrollment?: boolean
          id?: string
          instrument_id: string
          instrument_name: string
          lesson_kind: string
          starts_at: string
          status?: string
          student_id: string
          student_instrument_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          ends_at?: string
          generated_from_enrollment?: boolean
          id?: string
          instrument_id?: string
          instrument_name?: string
          lesson_kind?: string
          starts_at?: string
          status?: string
          student_id?: string
          student_instrument_id?: string | null
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_events_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_academy_student_instrument_fk"
            columns: ["academy_id", "student_instrument_id"]
            isOneToOne: false
            referencedRelation: "student_instruments"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_events_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_student_instrument_id_fkey"
            columns: ["student_instrument_id"]
            isOneToOne: false
            referencedRelation: "student_instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_events_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ticket_adjustments: {
        Row: {
          academy_id: string
          adjusted_at: string
          adjusted_by: string | null
          adjustment_reason: string
          created_at: string
          delta_count: number
          id: string
          instrument_id: string
          lesson_ticket_grant_id: string
          next_remaining_count: number
          previous_remaining_count: number
          student_id: string
        }
        Insert: {
          academy_id: string
          adjusted_at: string
          adjusted_by?: string | null
          adjustment_reason: string
          created_at?: string
          delta_count: number
          id?: string
          instrument_id: string
          lesson_ticket_grant_id: string
          next_remaining_count: number
          previous_remaining_count: number
          student_id: string
        }
        Update: {
          academy_id?: string
          adjusted_at?: string
          adjusted_by?: string | null
          adjustment_reason?: string
          created_at?: string
          delta_count?: number
          id?: string
          instrument_id?: string
          lesson_ticket_grant_id?: string
          next_remaining_count?: number
          previous_remaining_count?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ticket_adjustments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_adjustments_academy_lesson_ticket_grant_fk"
            columns: ["academy_id", "lesson_ticket_grant_id"]
            isOneToOne: false
            referencedRelation: "lesson_ticket_grants"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_adjustments_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_adjustments_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_adjustments_lesson_ticket_grant_id_fkey"
            columns: ["lesson_ticket_grant_id"]
            isOneToOne: false
            referencedRelation: "lesson_ticket_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_adjustments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ticket_grants: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          instrument_id: string
          instrument_name: string
          paid_amount: number
          paid_at: string | null
          registered_at: string
          remaining_count: number
          student_id: string
          total_granted_count: number
          updated_at: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          instrument_id: string
          instrument_name: string
          paid_amount?: number
          paid_at?: string | null
          registered_at: string
          remaining_count: number
          student_id: string
          total_granted_count: number
          updated_at?: string
          valid_from: string
          valid_until: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instrument_id?: string
          instrument_name?: string
          paid_amount?: number
          paid_at?: string | null
          registered_at?: string
          remaining_count?: number
          student_id?: string
          total_granted_count?: number
          updated_at?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ticket_grants_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_grants_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_grants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_grants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_ticket_usages: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          instrument_id: string
          lesson_event_id: string
          lesson_ticket_grant_id: string
          student_id: string
          used_at: string
          used_count: number
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          instrument_id: string
          lesson_event_id: string
          lesson_ticket_grant_id: string
          student_id: string
          used_at?: string
          used_count?: number
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          instrument_id?: string
          lesson_event_id?: string
          lesson_ticket_grant_id?: string
          student_id?: string
          used_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_ticket_usages_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_academy_lesson_event_fk"
            columns: ["academy_id", "lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_academy_lesson_ticket_grant_fk"
            columns: ["academy_id", "lesson_ticket_grant_id"]
            isOneToOne: false
            referencedRelation: "lesson_ticket_grants"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_lesson_event_id_fkey"
            columns: ["lesson_event_id"]
            isOneToOne: false
            referencedRelation: "lesson_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_lesson_ticket_grant_id_fkey"
            columns: ["lesson_ticket_grant_id"]
            isOneToOne: false
            referencedRelation: "lesson_ticket_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_ticket_usages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_memos: {
        Row: {
          academy_id: string
          content: string
          created_at: string
          id: string
          month: string
          unread: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academy_id: string
          content?: string
          created_at?: string
          id?: string
          month: string
          unread?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academy_id?: string
          content?: string
          created_at?: string
          id?: string
          month?: string
          unread?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_memos_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_memos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      salary_settlements: {
        Row: {
          academy_id: string
          base_pay: number
          created_at: string
          id: string
          lesson_event_ids: string[]
          month: string
          net_pay: number
          paid_at: string | null
          paid_ledger_entry_id: string | null
          pay_type: string
          status: string
          teacher_id: string
          teacher_name: string
          updated_at: string
          withholding_tax: number
        }
        Insert: {
          academy_id: string
          base_pay: number
          created_at?: string
          id?: string
          lesson_event_ids?: string[]
          month: string
          net_pay: number
          paid_at?: string | null
          paid_ledger_entry_id?: string | null
          pay_type: string
          status?: string
          teacher_id: string
          teacher_name: string
          updated_at?: string
          withholding_tax: number
        }
        Update: {
          academy_id?: string
          base_pay?: number
          created_at?: string
          id?: string
          lesson_event_ids?: string[]
          month?: string
          net_pay?: number
          paid_at?: string | null
          paid_ledger_entry_id?: string | null
          pay_type?: string
          status?: string
          teacher_id?: string
          teacher_name?: string
          updated_at?: string
          withholding_tax?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_settlements_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_settlements_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "salary_settlements_paid_ledger_fk"
            columns: ["academy_id", "paid_ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "salary_settlements_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_contacts: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          phone: string
          relationship: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          phone: string
          relationship: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          phone?: string
          relationship?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_contacts_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_contacts_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "student_contacts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_instruments: {
        Row: {
          academy_id: string
          active: boolean
          created_at: string
          discount_total: number
          end_time: string | null
          final_monthly_fee: number
          id: string
          instrument_id: string
          instrument_name: string
          lesson_fee: number
          lesson_type: string
          progress: string
          start_time: string | null
          student_id: string
          teacher_id: string | null
          updated_at: string
          weekdays: string[]
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          discount_total?: number
          end_time?: string | null
          final_monthly_fee?: number
          id?: string
          instrument_id: string
          instrument_name: string
          lesson_fee?: number
          lesson_type: string
          progress?: string
          start_time?: string | null
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          weekdays?: string[]
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          discount_total?: number
          end_time?: string | null
          final_monthly_fee?: number
          id?: string
          instrument_id?: string
          instrument_name?: string
          lesson_fee?: number
          lesson_type?: string
          progress?: string
          start_time?: string | null
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          weekdays?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "student_instruments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_instruments_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "student_instruments_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "student_instruments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_instruments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_teacher_assignments: {
        Row: {
          academy_id: string
          active: boolean
          created_at: string
          id: string
          instrument_name: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          id?: string
          instrument_name: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          id?: string
          instrument_name?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_teacher_assignments_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_academy_student_fk"
            columns: ["academy_id", "student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_teacher_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          name: string
          registered_on: string
          status: Database["public"]["Enums"]["student_status"]
          suspended_at: string | null
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          name: string
          registered_on: string
          status?: Database["public"]["Enums"]["student_status"]
          suspended_at?: string | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          name?: string
          registered_on?: string
          status?: Database["public"]["Enums"]["student_status"]
          suspended_at?: string | null
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_salary_settings: {
        Row: {
          academy_id: string
          active: boolean
          created_at: string
          hourly_rate: number | null
          id: string
          monthly_salary: number | null
          pay_type: string
          ratio_teacher_share: number | null
          rounding: string
          teacher_id: string
          updated_at: string
          withholding_tax_rate: number
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          pay_type: string
          ratio_teacher_share?: number | null
          rounding?: string
          teacher_id: string
          updated_at?: string
          withholding_tax_rate?: number
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          hourly_rate?: number | null
          id?: string
          monthly_salary?: number | null
          pay_type?: string
          ratio_teacher_share?: number | null
          rounding?: string
          teacher_id?: string
          updated_at?: string
          withholding_tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "teacher_salary_settings_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_salary_settings_academy_teacher_fk"
            columns: ["academy_id", "teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "teacher_salary_settings_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          member_id: string | null
          name: string
          part: string
          phone: string | null
          registered_on: string
          resident_registration_encrypted_ref: string | null
          resident_registration_masked: string | null
          salary_type: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          member_id?: string | null
          name: string
          part: string
          phone?: string | null
          registered_on: string
          resident_registration_encrypted_ref?: string | null
          resident_registration_masked?: string | null
          salary_type: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          member_id?: string | null
          name?: string
          part?: string
          phone?: string | null
          registered_on?: string
          resident_registration_encrypted_ref?: string | null
          resident_registration_masked?: string | null
          salary_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_academy_member_fk"
            columns: ["academy_id", "member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["academy_id", "id"]
          },
          {
            foreignKeyName: "teachers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "academy_members"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
          vendor_type: string | null
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
          vendor_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_monthly_academy_lesson_events: {
        Args: { p_academy_id: string; p_month: string }
        Returns: number
      }
      ensure_monthly_fixed_income_snapshots: {
        Args: { p_academy_id: string; p_month: string }
        Returns: Database["public"]["Tables"]["fixed_income_snapshots"]["Row"][]
      }
      mark_fixed_income_snapshot_paid: {
        Args: {
          p_academy_id: string
          p_paid_at: string
          p_snapshot_id: string
        }
        Returns: Database["public"]["Tables"]["fixed_income_snapshots"]["Row"]
      }
      mark_fixed_income_snapshot_unpaid: {
        Args: { p_academy_id: string; p_snapshot_id: string }
        Returns: Database["public"]["Tables"]["fixed_income_snapshots"]["Row"]
      }
      mark_salary_settlement_paid: {
        Args: {
          p_academy_id: string
          p_base_pay: number
          p_lesson_event_ids: string[]
          p_month: string
          p_net_pay: number
          p_paid_at: string
          p_pay_type: string
          p_teacher_id: string
          p_teacher_name: string
          p_withholding_tax: number
        }
        Returns: Database["public"]["Tables"]["salary_settlements"]["Row"]
      }
      mark_private_lesson_attendance: {
        Args: {
          p_academy_id: string
          p_instrument_id: string
          p_lesson_event_id: string
          p_marked_at?: string
          p_status: string
          p_student_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      academy_member_role: "owner" | "desk" | "teacher"
      academy_member_status: "active" | "invited" | "disabled"
      ledger_entry_source:
        | "tuition"
        | "book-sale"
        | "book-order"
        | "payroll"
        | "manual"
        | "lesson-ticket"
      ledger_entry_type: "income" | "expense"
      student_status: "enrolled" | "suspended" | "withdrawn"
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
  private: {
    Enums: {},
  },
  public: {
    Enums: {
      academy_member_role: ["owner", "desk", "teacher"],
      academy_member_status: ["active", "invited", "disabled"],
      ledger_entry_source: [
        "tuition",
        "book-sale",
        "book-order",
        "payroll",
        "manual",
        "lesson-ticket",
      ],
      ledger_entry_type: ["income", "expense"],
      student_status: ["enrolled", "suspended", "withdrawn"],
    },
  },
} as const
