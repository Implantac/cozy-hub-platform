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
      analytics_snapshots: {
        Row: {
          captured_at: string
          channel_id: string | null
          content_id: string | null
          created_at: string
          id: string
          metrics: Json
          workspace_id: string
        }
        Insert: {
          captured_at?: string
          channel_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          workspace_id: string
        }
        Update: {
          captured_at?: string
          channel_id?: string | null
          content_id?: string | null
          created_at?: string
          id?: string
          metrics?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_snapshots_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_memories: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          kind: Database["public"]["Enums"]["brain_memory_kind"]
          metadata: Json
          workspace_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind: Database["public"]["Enums"]["brain_memory_kind"]
          metadata?: Json
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["brain_memory_kind"]
          metadata?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_recommendations: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          payload: Json
          rationale: string | null
          score: number
          status: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          payload?: Json
          rationale?: string | null
          score?: number
          status?: Database["public"]["Enums"]["recommendation_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          payload?: Json
          rationale?: string | null
          score?: number
          status?: Database["public"]["Enums"]["recommendation_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brain_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_url: string | null
          name: string
          palette: Json
          updated_at: string
          voice: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          palette?: Json
          updated_at?: string
          voice?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          palette?: Json
          updated_at?: string
          voice?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          brand_id: string | null
          connected_at: string | null
          created_at: string
          external_id: string | null
          handle: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          platform: Database["public"]["Enums"]["social_platform"]
          status: Database["public"]["Enums"]["channel_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          connected_at?: string | null
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          platform: Database["public"]["Enums"]["social_platform"]
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          connected_at?: string | null
          created_at?: string
          external_id?: string | null
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          platform?: Database["public"]["Enums"]["social_platform"]
          status?: Database["public"]["Enums"]["channel_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          ai_generated: boolean
          body: string | null
          brand_id: string | null
          created_at: string
          created_by: string | null
          id: string
          media: Json
          metadata: Json
          status: Database["public"]["Enums"]["content_status"]
          title: string | null
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ai_generated?: boolean
          body?: string | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media?: Json
          metadata?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ai_generated?: boolean
          body?: string | null
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          media?: Json
          metadata?: Json
          status?: Database["public"]["Enums"]["content_status"]
          title?: string | null
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          tags: string[]
          updated_at: string
          variables: Json
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tags?: string[]
          updated_at?: string
          variables?: Json
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tags?: string[]
          updated_at?: string
          variables?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          provider: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          provider: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          metadata: Json
          priority: number
          status: Database["public"]["Enums"]["mission_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          priority?: number
          status?: Database["public"]["Enums"]["mission_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          metadata?: Json
          priority?: number
          status?: Database["public"]["Enums"]["mission_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "missions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token_ciphertext: string
          channel_id: string
          created_at: string
          expires_at: string | null
          id: string
          refresh_token_ciphertext: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext: string
          channel_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_ciphertext?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string
          channel_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          refresh_token_ciphertext?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_workspace_id: string | null
          display_name: string | null
          id: string
          locale: string
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          id: string
          locale?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          display_name?: string | null
          id?: string
          locale?: string
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scheduler_jobs: {
        Row: {
          attempts: number
          channel_id: string
          content_id: string
          created_at: string
          external_post_id: string | null
          id: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          run_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempts?: number
          channel_id: string
          content_id: string
          created_at?: string
          external_post_id?: string | null
          id?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          run_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempts?: number
          channel_id?: string
          content_id?: string
          created_at?: string
          external_post_id?: string | null
          id?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          run_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_jobs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["workspace_plan"]
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["workspace_plan"]
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace_role: {
        Args: { _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id?: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id?: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "editor" | "viewer"
      brain_memory_kind:
        | "fact"
        | "preference"
        | "goal"
        | "signal"
        | "outcome"
        | "strategy"
      channel_status: "disconnected" | "connected" | "expired" | "error"
      content_status:
        | "draft"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "archived"
      content_type:
        | "post"
        | "reel"
        | "story"
        | "short"
        | "video"
        | "article"
        | "carousel"
      job_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "dead_letter"
        | "cancelled"
      mission_status: "pending" | "in_progress" | "done" | "dismissed"
      recommendation_status: "open" | "applied" | "dismissed" | "expired"
      social_platform:
        | "instagram"
        | "facebook"
        | "youtube"
        | "tiktok"
        | "linkedin"
      workspace_plan: "free" | "pro" | "business" | "enterprise"
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
      app_role: ["owner", "admin", "editor", "viewer"],
      brain_memory_kind: [
        "fact",
        "preference",
        "goal",
        "signal",
        "outcome",
        "strategy",
      ],
      channel_status: ["disconnected", "connected", "expired", "error"],
      content_status: [
        "draft",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "archived",
      ],
      content_type: [
        "post",
        "reel",
        "story",
        "short",
        "video",
        "article",
        "carousel",
      ],
      job_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "dead_letter",
        "cancelled",
      ],
      mission_status: ["pending", "in_progress", "done", "dismissed"],
      recommendation_status: ["open", "applied", "dismissed", "expired"],
      social_platform: [
        "instagram",
        "facebook",
        "youtube",
        "tiktok",
        "linkedin",
      ],
      workspace_plan: ["free", "pro", "business", "enterprise"],
    },
  },
} as const
