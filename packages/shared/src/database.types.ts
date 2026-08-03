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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_text: string
          actor_kind: string
          actor_label: string
          created_at: string
          id: string
          wedding_id: string
        }
        Insert: {
          action_text: string
          actor_kind: string
          actor_label: string
          created_at?: string
          id?: string
          wedding_id: string
        }
        Update: {
          action_text?: string
          actor_kind?: string
          actor_label?: string
          created_at?: string
          id?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          answers: Json
          form_id: string
          guest_id: string
          id: string
          submitted_at: string
        }
        Insert: {
          answers?: Json
          form_id: string
          guest_id: string
          id?: string
          submitted_at?: string
        }
        Update: {
          answers?: Json
          form_id?: string
          guest_id?: string
          id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          kind: string
          opens_at: string | null
          published: boolean
          purpose: string
          questions: Json
          rsvp_copy: Json
          sort_order: number
          title: string
          wedding_id: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          opens_at?: string | null
          published?: boolean
          purpose?: string
          questions?: Json
          rsvp_copy?: Json
          sort_order?: number
          title: string
          wedding_id: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          opens_at?: string | null
          published?: boolean
          purpose?: string
          questions?: Json
          rsvp_copy?: Json
          sort_order?: number
          title?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_group_members: {
        Row: {
          created_at: string
          group_id: string
          guest_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          guest_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          guest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "guest_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_group_members_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_groups: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
          wedding_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          wedding_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_groups_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_relationships: {
        Row: {
          created_at: string
          from_guest: string
          kind: Database["public"]["Enums"]["guest_relationship_kind"]
          to_guest: string
          wedding_id: string
        }
        Insert: {
          created_at?: string
          from_guest: string
          kind: Database["public"]["Enums"]["guest_relationship_kind"]
          to_guest: string
          wedding_id: string
        }
        Update: {
          created_at?: string
          from_guest?: string
          kind?: Database["public"]["Enums"]["guest_relationship_kind"]
          to_guest?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_relationships_from_guest_fkey"
            columns: ["from_guest"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_to_guest_fkey"
            columns: ["to_guest"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_relationships_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          added_by_guest_id: string | null
          age_years: number | null
          can_add_kids: boolean | null
          can_add_partner: boolean | null
          ceremony_row: number | null
          ceremony_side: string | null
          created_at: string
          email: string | null
          first_name: string
          guest_group: string | null
          id: string
          invite_token: string
          last_name: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          role: string | null
          room_block_id: string | null
          rsvp_reminder_sent_at: string | null
          seating_table_id: string | null
          wedding_id: string
        }
        Insert: {
          added_by_guest_id?: string | null
          age_years?: number | null
          can_add_kids?: boolean | null
          can_add_partner?: boolean | null
          ceremony_row?: number | null
          ceremony_side?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          guest_group?: string | null
          id?: string
          invite_token?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          room_block_id?: string | null
          rsvp_reminder_sent_at?: string | null
          seating_table_id?: string | null
          wedding_id: string
        }
        Update: {
          added_by_guest_id?: string | null
          age_years?: number | null
          can_add_kids?: boolean | null
          can_add_partner?: boolean | null
          ceremony_row?: number | null
          ceremony_side?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          guest_group?: string | null
          id?: string
          invite_token?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          role?: string | null
          room_block_id?: string | null
          rsvp_reminder_sent_at?: string | null
          seating_table_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_added_by_guest_id_fkey"
            columns: ["added_by_guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_room_block_id_fkey"
            columns: ["room_block_id"]
            isOneToOne: false
            referencedRelation: "room_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_seating_table_id_fkey"
            columns: ["seating_table_id"]
            isOneToOne: false
            referencedRelation: "seating_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_merge_clusters: {
        Row: {
          cluster_key: string
          hidden_at: string
          wedding_id: string
        }
        Insert: {
          cluster_key: string
          hidden_at?: string
          wedding_id: string
        }
        Update: {
          cluster_key?: string
          hidden_at?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_merge_clusters_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      room_blocks: {
        Row: {
          booked_rooms: number
          capacity_rooms: number
          created_at: string
          id: string
          name: string
          note: string | null
          price_note: string | null
          sort_order: number
          status: string | null
          tone: string
          wedding_id: string
        }
        Insert: {
          booked_rooms?: number
          capacity_rooms?: number
          created_at?: string
          id?: string
          name: string
          note?: string | null
          price_note?: string | null
          sort_order?: number
          status?: string | null
          tone?: string
          wedding_id: string
        }
        Update: {
          booked_rooms?: number
          capacity_rooms?: number
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          price_note?: string | null
          sort_order?: number
          status?: string | null
          tone?: string
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_blocks_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvps: {
        Row: {
          dietary_notes: string | null
          guest_id: string
          id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
        }
        Insert: {
          dietary_notes?: string | null
          guest_id: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
        }
        Update: {
          dietary_notes?: string | null
          guest_id?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: true
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
        ]
      }
      seating_tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_head: boolean
          name: string
          shape: string
          sort_order: number
          tone: string
          wedding_id: string
          x_pct: number
          y_pct: number
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_head?: boolean
          name: string
          shape?: string
          sort_order?: number
          tone?: string
          wedding_id: string
          x_pct?: number
          y_pct?: number
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_head?: boolean
          name?: string
          shape?: string
          sort_order?: number
          tone?: string
          wedding_id?: string
          x_pct?: number
          y_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "seating_tables_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_collaborators: {
        Row: {
          email: string
          id: string
          invited_at: string
          joined_at: string | null
          status: string
          user_id: string | null
          wedding_id: string
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          status?: string
          user_id?: string | null
          wedding_id: string
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          joined_at?: string | null
          status?: string
          user_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wedding_collaborators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_collaborators_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
            referencedColumns: ["id"]
          },
        ]
      }
      weddings: {
        Row: {
          allow_guests_add_children: boolean
          allow_guests_add_partner: boolean
          autonomy: string
          ceremony_reserved_rows: number
          ceremony_rows: number
          created_at: string
          event_date: string | null
          guest_count_target: number | null
          id: string
          max_children_per_guest: number | null
          owner_id: string
          partner_one: string | null
          partner_two: string | null
          rsvp_form_questions: Json | null
          sms_brevo_api_key: string | null
          sms_sender: string | null
          sms_template: string | null
          style_vibe: string | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          allow_guests_add_children?: boolean
          allow_guests_add_partner?: boolean
          autonomy?: string
          ceremony_reserved_rows?: number
          ceremony_rows?: number
          created_at?: string
          event_date?: string | null
          guest_count_target?: number | null
          id?: string
          max_children_per_guest?: number | null
          owner_id: string
          partner_one?: string | null
          partner_two?: string | null
          rsvp_form_questions?: Json | null
          sms_brevo_api_key?: string | null
          sms_sender?: string | null
          sms_template?: string | null
          style_vibe?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          allow_guests_add_children?: boolean
          allow_guests_add_partner?: boolean
          autonomy?: string
          ceremony_reserved_rows?: number
          ceremony_rows?: number
          created_at?: string
          event_date?: string | null
          guest_count_target?: number | null
          id?: string
          max_children_per_guest?: number | null
          owner_id?: string
          partner_one?: string | null
          partner_two?: string | null
          rsvp_form_questions?: Json | null
          sms_brevo_api_key?: string | null
          sms_sender?: string | null
          sms_template?: string | null
          style_vibe?: string | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weddings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pending_invites: { Args: Record<PropertyKey, never>; Returns: undefined }
      _cluster_key: { Args: { p_ids: string[] }; Returns: string }
      _guest_matches: {
        Args: {
          a_age: number
          a_first: string
          a_last: string
          b_age: number
          b_first: string
          b_last: string
        }
        Returns: boolean
      }
      _merge_guests: {
        Args: { p_source_id: string; p_target_id: string }
        Returns: string
      }
      create_guest_with_links: {
        Args: {
          p_age_years?: number
          p_email?: string
          p_first_name: string
          p_group_ids?: string[]
          p_last_name?: string
          p_new_children?: Json[]
          p_new_partner?: Json
          p_notes?: string
          p_parent_ids?: string[]
          p_partner_id?: string
          p_phone?: string
          p_primary_group?: string
          p_role?: string
          p_wedding_id: string
        }
        Returns: {
          added_by_guest_id: string | null
          age_years: number | null
          can_add_kids: boolean | null
          can_add_partner: boolean | null
          ceremony_row: number | null
          ceremony_side: string | null
          created_at: string
          email: string | null
          first_name: string
          guest_group: string | null
          id: string
          invite_token: string
          last_name: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          role: string | null
          room_block_id: string | null
          rsvp_reminder_sent_at: string | null
          seating_table_id: string | null
          wedding_id: string
        }
        SetofOptions: {
          from: "*"
          to: "guests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_duplicate_groups: { Args: { p_wedding_id: string }; Returns: Json }
      get_invitation: { Args: { p_token: string }; Returns: Json }
      hide_duplicate_cluster: {
        Args: { p_guest_ids: string[]; p_wedding_id: string }
        Returns: undefined
      }
      list_hidden_merge_clusters: {
        Args: { p_wedding_id: string }
        Returns: Json
      }
      owner_merge_guests: {
        Args: {
          p_source_guest_id: string
          p_target_guest_id: string
          p_target_overrides?: Json
        }
        Returns: Json
      }
      rsvp_merge_into: {
        Args: { p_target_guest_id: string; p_token: string }
        Returns: Json
      }
      rsvp_register_companion: {
        Args: {
          p_first_name: string
          p_kind: string
          p_last_name?: string
          p_resolve?: string
          p_token: string
        }
        Returns: Json
      }
      submit_companion_rsvp: {
        Args: {
          p_companion_guest_id: string
          p_dietary_notes?: string
          p_status: string
          p_token: string
        }
        Returns: Json
      }
      submit_form_response: {
        Args: { p_answers: Json; p_form_id: string; p_token: string }
        Returns: Json
      }
      submit_rsvp: {
        Args: {
          p_dietary_notes?: string
          p_message?: string
          p_status: string
          p_token: string
        }
        Returns: undefined
      }
      unhide_duplicate_cluster: {
        Args: { p_guest_ids: string[]; p_wedding_id: string }
        Returns: undefined
      }
    }
    Enums: {
      guest_relationship_kind: "parent_of" | "partner_of"
      rsvp_status: "pending" | "attending" | "declined"
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
      guest_relationship_kind: ["parent_of", "partner_of"],
      rsvp_status: ["pending", "attending", "declined"],
    },
  },
} as const
