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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
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
      buy_requirements: {
        Row: {
          buyer_id: string
          category_id: string | null
          contact_email: string | null
          contact_name: string
          created_at: string
          id: string
          is_public: boolean
          location: string | null
          notes: string | null
          product_text: string
          quantity: string
        }
        Insert: {
          buyer_id: string
          category_id?: string | null
          contact_email?: string | null
          contact_name: string
          created_at?: string
          id?: string
          is_public?: boolean
          location?: string | null
          notes?: string | null
          product_text: string
          quantity: string
        }
        Update: {
          buyer_id?: string
          category_id?: string | null
          contact_email?: string | null
          contact_name?: string
          created_at?: string
          id?: string
          is_public?: boolean
          location?: string | null
          notes?: string | null
          product_text?: string
          quantity?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_requirements_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_requirements_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          phone_raw: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          phone_raw?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          phone_raw?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          about: string | null
          clerk_user_id: string | null
          country: string
          created_at: string
          email: string
          id: string
          location: string | null
          logo_url: string | null
          name: string
          rejection_reason: string | null
          slug: string
          status: string
          submitted_by: string
          updated_at: string
          verified: boolean
        }
        Insert: {
          about?: string | null
          clerk_user_id?: string | null
          country?: string
          created_at?: string
          email: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          rejection_reason?: string | null
          slug: string
          status?: string
          submitted_by: string
          updated_at?: string
          verified?: boolean
        }
        Update: {
          about?: string | null
          clerk_user_id?: string | null
          country?: string
          created_at?: string
          email?: string
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          rejection_reason?: string | null
          slug?: string
          status?: string
          submitted_by?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      company_contacts: {
        Row: {
          company_id: string
          created_at: string
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          company_id: string
          created_at?: string
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          company_id?: string
          created_at?: string
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "company_tiers"
            referencedColumns: ["company_id"]
          },
        ]
      }
      enquiries: {
        Row: {
          buy_requirement_id: string | null
          buyer_id: string
          company_id: string | null
          company_name: string | null
          contact_email: string | null
          contact_name: string
          created_at: string
          id: string
          message: string | null
          product_id: string | null
          product_name: string | null
          whatsapp_attempts: number
          whatsapp_forwarded_at: string | null
          whatsapp_last_error: string | null
        }
        Insert: {
          buy_requirement_id?: string | null
          buyer_id: string
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name: string
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          product_name?: string | null
          whatsapp_attempts?: number
          whatsapp_forwarded_at?: string | null
          whatsapp_last_error?: string | null
        }
        Update: {
          buy_requirement_id?: string | null
          buyer_id?: string
          company_id?: string | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string
          created_at?: string
          id?: string
          message?: string | null
          product_id?: string | null
          product_name?: string | null
          whatsapp_attempts?: number
          whatsapp_forwarded_at?: string | null
          whatsapp_last_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_buy_requirement_id_fkey"
            columns: ["buy_requirement_id"]
            isOneToOne: false
            referencedRelation: "buy_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_tiers"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "enquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          source: string
          starts_at: string
          status: string
          tier: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source: string
          starts_at?: string
          status: string
          tier: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_tiers"
            referencedColumns: ["company_id"]
          },
        ]
      }
      products: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          category_id: string
          company_id: string
          created_at: string
          description: string | null
          gallery_urls: string[]
          id: string
          image_url: string
          name: string
          rejection_reason: string | null
          slug: string
          status: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          company_id: string
          created_at?: string
          description?: string | null
          gallery_urls?: string[]
          id?: string
          image_url: string
          name: string
          rejection_reason?: string | null
          slug: string
          status?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          company_id?: string
          created_at?: string
          description?: string | null
          gallery_urls?: string[]
          id?: string
          image_url?: string
          name?: string
          rejection_reason?: string | null
          slug?: string
          status?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_tiers"
            referencedColumns: ["company_id"]
          },
        ]
      }
    }
    Views: {
      company_tiers: {
        Row: {
          company_id: string | null
          tier: string | null
        }
        Insert: {
          company_id?: string | null
          tier?: never
        }
        Update: {
          company_id?: string | null
          tier?: never
        }
        Relationships: []
      }
      directory_stats: {
        Row: {
          buyers: number | null
          countries: number | null
          products: number | null
          verified_exporters: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_business_listing: {
        Args: {
          p_about: string
          p_clerk_user_id: string
          p_email: string
          p_location: string
          p_logo_url: string
          p_name: string
          p_whatsapp_number: string
        }
        Returns: {
          company_id: string
          status: string
        }[]
      }
      create_buy_requirement: {
        Args: {
          p_category_id: string
          p_email: string
          p_is_public: boolean
          p_location: string
          p_name: string
          p_notes: string
          p_phone: string
          p_product_text: string
          p_quantity: string
        }
        Returns: {
          buy_requirement_id: string
          rate_limited: boolean
        }[]
      }
      create_company_enquiry: {
        Args: {
          p_company_id: string
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
        }
        Returns: {
          enquiry_id: string
          rate_limited: boolean
          whatsapp_number: string
        }[]
      }
      create_enquiry: {
        Args: {
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
          p_product_id: string
        }
        Returns: {
          enquiry_id: string
          rate_limited: boolean
          whatsapp_number: string
        }[]
      }
      get_or_create_buyer: {
        Args: { p_email?: string; p_name: string; p_phone: string }
        Returns: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          phone_raw: string | null
        }
        SetofOptions: {
          from: "*"
          to: "buyers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      slugify: { Args: { p_text: string }; Returns: string }
      update_business_listing: {
        Args: {
          p_about: string
          p_clerk_user_id: string
          p_email: string
          p_location: string
          p_logo_url: string
          p_name: string
          p_whatsapp_number: string
        }
        Returns: {
          company_id: string
          status: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
