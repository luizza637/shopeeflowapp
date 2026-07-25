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
      ai_generations: {
        Row: {
          caption: string | null
          created_at: string
          cta: string | null
          description: string | null
          duration_seconds: number | null
          hashtags: string | null
          hook: string | null
          id: string
          model: string | null
          product_id: string | null
          script: string | null
          title: string | null
          titles: Json | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          duration_seconds?: number | null
          hashtags?: string | null
          hook?: string | null
          id?: string
          model?: string | null
          product_id?: string | null
          script?: string | null
          title?: string | null
          titles?: Json | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          cta?: string | null
          description?: string | null
          duration_seconds?: number | null
          hashtags?: string | null
          hook?: string | null
          id?: string
          model?: string | null
          product_id?: string | null
          script?: string | null
          title?: string | null
          titles?: Json | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string | null
          category: string | null
          commission_percent: number | null
          created_at: string
          discount_percent: number | null
          id: string
          image_url: string | null
          is_favorite: boolean
          is_public: boolean
          name: string
          notes: string | null
          original_price: number | null
          price: number | null
          rating: number | null
          sales_count: number | null
          shop_name: string | null
          sort_order: number
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          category?: string | null
          commission_percent?: number | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          is_public?: boolean
          name: string
          notes?: string | null
          original_price?: number | null
          price?: number | null
          rating?: number | null
          sales_count?: number | null
          shop_name?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          affiliate_url?: string | null
          category?: string | null
          commission_percent?: number | null
          created_at?: string
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          is_public?: boolean
          name?: string
          notes?: string | null
          original_price?: number | null
          price?: number | null
          rating?: number | null
          sales_count?: number | null
          shop_name?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          slug: string | null
          storefront_bio: string | null
          storefront_published: boolean
          storefront_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          slug?: string | null
          storefront_bio?: string | null
          storefront_published?: boolean
          storefront_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          slug?: string | null
          storefront_bio?: string | null
          storefront_published?: boolean
          storefront_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          attempt_count: number
          caption: string | null
          created_at: string
          error_message: string | null
          external_id: string | null
          external_url: string | null
          hashtags: string | null
          id: string
          platform: string
          product_id: string | null
          published_at: string | null
          scheduled_at: string
          status: string
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          attempt_count?: number
          caption?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          hashtags?: string | null
          id?: string
          platform: string
          product_id?: string | null
          published_at?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          attempt_count?: number
          caption?: string | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          hashtags?: string | null
          id?: string
          platform?: string
          product_id?: string | null
          published_at?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_posts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_views: {
        Row: {
          created_at: string
          day: string
          id: string
          profile_id: string
          referrer: string | null
          slug: string
          visitor_hash: string | null
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          profile_id: string
          referrer?: string | null
          slug: string
          visitor_hash?: string | null
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          profile_id?: string
          referrer?: string | null
          slug?: string
          visitor_hash?: string | null
        }
        Relationships: []
      }
      user_ai_keys: {
        Row: {
          created_at: string
          gemini_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gemini_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gemini_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          generation_id: string | null
          height: number | null
          id: string
          mime_type: string | null
          narration_path: string | null
          product_id: string | null
          size_bytes: number | null
          status: string
          storage_path: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          generation_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          narration_path?: string | null
          product_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          generation_id?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          narration_path?: string | null
          product_id?: string | null
          size_bytes?: number | null
          status?: string
          storage_path?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "videos_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "ai_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
