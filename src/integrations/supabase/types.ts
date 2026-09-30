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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      blocked_slots: {
        Row: {
          date: string
          id: string
          reason: string
          time: string
        }
        Insert: {
          date: string
          id?: string
          reason?: string
          time: string
        }
        Update: {
          date?: string
          id?: string
          reason?: string
          time?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          approval_status: string | null
          area: string | null
          clean_preview_url: string | null
          client_id: string | null
          colour: string | null
          created_at: string
          date: string | null
          deposit_paid: boolean
          email_status: string | null
          end_date: string | null
          full_day: boolean
          guard_permission: boolean | null
          id: string
          location_type: string
          manage_token: string
          map_pin: Json | null
          photo_url: string | null
          plan: string
          status: string
          style: string | null
          time: string | null
          total: number
          vehicle_model: string | null
          video_job_id: string | null
          video_status: string | null
          video_url: string | null
          water_needed: boolean | null
        }
        Insert: {
          approval_status?: string | null
          area?: string | null
          clean_preview_url?: string | null
          client_id?: string | null
          colour?: string | null
          created_at?: string
          date?: string | null
          deposit_paid?: boolean
          email_status?: string | null
          end_date?: string | null
          full_day?: boolean
          guard_permission?: boolean | null
          id?: string
          location_type?: string
          manage_token?: string
          map_pin?: Json | null
          photo_url?: string | null
          plan: string
          status?: string
          style?: string | null
          time?: string | null
          total?: number
          vehicle_model?: string | null
          video_job_id?: string | null
          video_status?: string | null
          video_url?: string | null
          water_needed?: boolean | null
        }
        Update: {
          approval_status?: string | null
          area?: string | null
          clean_preview_url?: string | null
          client_id?: string | null
          colour?: string | null
          created_at?: string
          date?: string | null
          deposit_paid?: boolean
          email_status?: string | null
          end_date?: string | null
          full_day?: boolean
          guard_permission?: boolean | null
          id?: string
          location_type?: string
          manage_token?: string
          map_pin?: Json | null
          photo_url?: string | null
          plan?: string
          status?: string
          style?: string | null
          time?: string | null
          total?: number
          vehicle_model?: string | null
          video_job_id?: string | null
          video_status?: string | null
          video_url?: string | null
          water_needed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          area: string | null
          building: string | null
          created_at: string
          email: string | null
          floor: string | null
          id: string
          name: string
          phone: string
          water_access: boolean
        }
        Insert: {
          area?: string | null
          building?: string | null
          created_at?: string
          email?: string | null
          floor?: string | null
          id?: string
          name: string
          phone: string
          water_access?: boolean
        }
        Update: {
          area?: string | null
          building?: string | null
          created_at?: string
          email?: string | null
          floor?: string | null
          id?: string
          name?: string
          phone?: string
          water_access?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          booking_id: string
          created_at: string
          demo: boolean
          id: string
          method: string
          status: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string
          demo?: boolean
          id?: string
          method: string
          status: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string
          demo?: boolean
          id?: string
          method?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          id: string
          plan: string
          preferred_time: string
          skip_dates: string[]
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          id?: string
          plan?: string
          preferred_time?: string
          skip_dates?: string[]
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          id?: string
          plan?: string
          preferred_time?: string
          skip_dates?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          area: string
          client_id: string
          created_at: string
          date: string
          id: string
        }
        Insert: {
          area: string
          client_id: string
          created_at?: string
          date: string
          id?: string
        }
        Update: {
          area?: string
          client_id?: string
          created_at?: string
          date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_slot: {
        Args: {
          p_booking_id: string
          p_date: string
          p_days?: number
          p_mobile: boolean
          p_time: string
          p_water: boolean
        }
        Returns: string
      }
      claim_owner: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
