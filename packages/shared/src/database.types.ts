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
      guests: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          guest_group: string | null
          id: string
          invite_token: string
          last_name: string | null
          notes: string | null
          party_size: number
          phone: string | null
          role: string | null
          room_block_id: string | null
          rsvp_reminder_sent_at: string | null
          seating_table_id: string | null
          wedding_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          guest_group?: string | null
          id?: string
          invite_token?: string
          last_name?: string | null
          notes?: string | null
          party_size?: number
          phone?: string | null
          role?: string | null
          room_block_id?: string | null
          rsvp_reminder_sent_at?: string | null
          seating_table_id?: string | null
          wedding_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          guest_group?: string | null
          id?: string
          invite_token?: string
          last_name?: string | null
          notes?: string | null
          party_size?: number
          phone?: string | null
          role?: string | null
          room_block_id?: string | null
          rsvp_reminder_sent_at?: string | null
          seating_table_id?: string | null
          wedding_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guests_wedding_id_fkey"
            columns: ["wedding_id"]
            isOneToOne: false
            referencedRelation: "weddings"
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
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      rsvps: {
        Row: {
          dietary_notes: string | null
          guest_id: string
          id: string
          message: string | null
          num_attending: number | null
          responded_at: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
        }
        Insert: {
          dietary_notes?: string | null
          guest_id: string
          id?: string
          message?: string | null
          num_attending?: number | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
        }
        Update: {
          dietary_notes?: string | null
          guest_id?: string
          id?: string
          message?: string | null
          num_attending?: number | null
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
      weddings: {
        Row: {
          created_at: string
          event_date: string | null
          id: string
          owner_id: string
          partner_one: string | null
          partner_two: string | null
          rsvp_form_questions: Json | null
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          id?: string
          owner_id: string
          partner_one?: string | null
          partner_two?: string | null
          rsvp_form_questions?: Json | null
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string | null
          id?: string
          owner_id?: string
          partner_one?: string | null
          partner_two?: string | null
          rsvp_form_questions?: Json | null
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
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          dietary_notes: string
          event_date: string
          guest_first_name: string
          guest_id: string
          guest_last_name: string
          message: string
          num_attending: number
          partner_one: string
          partner_two: string
          party_size: number
          rsvp_status: Database["public"]["Enums"]["rsvp_status"]
          venue_address: string
          venue_name: string
        }[]
      }
      submit_rsvp: {
        Args: {
          p_dietary_notes?: string
          p_message?: string
          p_num_attending?: number
          p_status: string
          p_token: string
        }
        Returns: undefined
      }
    }
    Enums: {
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
      rsvp_status: ["pending", "attending", "declined"],
    },
  },
} as const
