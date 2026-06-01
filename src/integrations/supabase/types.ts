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
            foreignKeyName: "analytics_snapshots_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channel_health"
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_answers: {
        Row: {
          answer: Json
          computed_at: string
          confidence: number
          expires_at: string | null
          id: string
          question: Database["public"]["Enums"]["brain_question"]
          workspace_id: string
        }
        Insert: {
          answer?: Json
          computed_at?: string
          confidence?: number
          expires_at?: string | null
          id?: string
          question: Database["public"]["Enums"]["brain_question"]
          workspace_id: string
        }
        Update: {
          answer?: Json
          computed_at?: string
          confidence?: number
          expires_at?: string | null
          id?: string
          question?: Database["public"]["Enums"]["brain_question"]
          workspace_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "brain_memories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_memory_events: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["brain_event_kind"]
          payload: Json
          sentiment: string | null
          subject: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["brain_event_kind"]
          payload?: Json
          sentiment?: string | null
          subject: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["brain_event_kind"]
          payload?: Json
          sentiment?: string | null
          subject?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "brain_recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brain_snapshots: {
        Row: {
          computed_at: string
          id: string
          scores: Json
          signals: Json
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          computed_at?: string
          id?: string
          scores?: Json
          signals?: Json
          snapshot?: Json
          workspace_id: string
        }
        Update: {
          computed_at?: string
          id?: string
          scores?: Json
          signals?: Json
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
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
      coach_recommendations: {
        Row: {
          body: string | null
          completed_at: string | null
          created_at: string
          cta: Json
          dismissed_at: string | null
          id: string
          kind: Database["public"]["Enums"]["coach_kind"]
          score: number
          severity: Database["public"]["Enums"]["coach_severity"]
          title: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          completed_at?: string | null
          created_at?: string
          cta?: Json
          dismissed_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["coach_kind"]
          score?: number
          severity?: Database["public"]["Enums"]["coach_severity"]
          title: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          completed_at?: string | null
          created_at?: string
          cta?: Json
          dismissed_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["coach_kind"]
          score?: number
          severity?: Database["public"]["Enums"]["coach_severity"]
          title?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "content_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_scores: {
        Row: {
          branding: number
          breakdown: Json
          channel_setup: number
          computed_at: string
          consistency: number
          content: number
          growth: number
          id: string
          overall: number
          presence: number
          workspace_id: string
        }
        Insert: {
          branding?: number
          breakdown?: Json
          channel_setup?: number
          computed_at?: string
          consistency?: number
          content?: number
          growth?: number
          id?: string
          overall?: number
          presence?: number
          workspace_id: string
        }
        Update: {
          branding?: number
          breakdown?: Json
          channel_setup?: number
          computed_at?: string
          consistency?: number
          content?: number
          growth?: number
          id?: string
          overall?: number
          presence?: number
          workspace_id?: string
        }
        Relationships: []
      }
      domain_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "domain_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      health_metrics: {
        Row: {
          category: Database["public"]["Enums"]["health_category"]
          computed_at: string
          details: Json
          id: string
          score: number
          strengths: string[]
          weaknesses: string[]
          workspace_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["health_category"]
          computed_at?: string
          details?: Json
          id?: string
          score?: number
          strengths?: string[]
          weaknesses?: string[]
          workspace_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["health_category"]
          computed_at?: string
          details?: Json
          id?: string
          score?: number
          strengths?: string[]
          weaknesses?: string[]
          workspace_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_progress: {
        Row: {
          completed_at: string | null
          completed_milestones: string[]
          id: string
          path_id: string
          progress_pct: number
          started_at: string
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_milestones?: string[]
          id?: string
          path_id: string
          progress_pct?: number
          started_at?: string
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_milestones?: string[]
          id?: string
          path_id?: string
          progress_pct?: number
          started_at?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          difficulty: Database["public"]["Enums"]["experience_level"]
          estimated_hours: number
          id: string
          milestones: Json
          recommended_for: Database["public"]["Enums"]["business_path"][]
          slug: string
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["experience_level"]
          estimated_hours?: number
          id?: string
          milestones?: Json
          recommended_for?: Database["public"]["Enums"]["business_path"][]
          slug: string
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["experience_level"]
          estimated_hours?: number
          id?: string
          milestones?: Json
          recommended_for?: Database["public"]["Enums"]["business_path"][]
          slug?: string
          title?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
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
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_tokens_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "v_channel_health"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          actions: Json
          competition: Database["public"]["Enums"]["opportunity_level"]
          created_at: string
          description: string | null
          difficulty: Database["public"]["Enums"]["opportunity_level"]
          expires_at: string | null
          growth_potential: Database["public"]["Enums"]["opportunity_level"]
          id: string
          niche: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          tags: string[]
          title: string
          workspace_id: string | null
        }
        Insert: {
          actions?: Json
          competition?: Database["public"]["Enums"]["opportunity_level"]
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["opportunity_level"]
          expires_at?: string | null
          growth_potential?: Database["public"]["Enums"]["opportunity_level"]
          id?: string
          niche?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          tags?: string[]
          title: string
          workspace_id?: string | null
        }
        Update: {
          actions?: Json
          competition?: Database["public"]["Enums"]["opportunity_level"]
          created_at?: string
          description?: string | null
          difficulty?: Database["public"]["Enums"]["opportunity_level"]
          expires_at?: string | null
          growth_potential?: Database["public"]["Enums"]["opportunity_level"]
          id?: string
          niche?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          tags?: string[]
          title?: string
          workspace_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "scheduler_jobs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "v_channel_health"
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
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
      user_profile_digital: {
        Row: {
          business_path: Database["public"]["Enums"]["business_path"] | null
          completed_at: string | null
          content_preferences: string[]
          created_at: string
          experience_level: Database["public"]["Enums"]["experience_level"]
          goals: string[]
          maturity_level: Database["public"]["Enums"]["maturity_level"]
          money_budget_monthly: number
          preferred_channels: string[]
          recommended_actions: Json
          time_budget_hours_week: number
          updated_at: string
          user_id: string
        }
        Insert: {
          business_path?: Database["public"]["Enums"]["business_path"] | null
          completed_at?: string | null
          content_preferences?: string[]
          created_at?: string
          experience_level?: Database["public"]["Enums"]["experience_level"]
          goals?: string[]
          maturity_level?: Database["public"]["Enums"]["maturity_level"]
          money_budget_monthly?: number
          preferred_channels?: string[]
          recommended_actions?: Json
          time_budget_hours_week?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          business_path?: Database["public"]["Enums"]["business_path"] | null
          completed_at?: string | null
          content_preferences?: string[]
          created_at?: string
          experience_level?: Database["public"]["Enums"]["experience_level"]
          goals?: string[]
          maturity_level?: Database["public"]["Enums"]["maturity_level"]
          money_budget_monthly?: number
          preferred_channels?: string[]
          recommended_actions?: Json
          time_budget_hours_week?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
          },
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
      v_channel_health: {
        Row: {
          brand_id: string | null
          connected_at: string | null
          handle: string | null
          id: string | null
          last_synced_at: string | null
          platform: Database["public"]["Enums"]["social_platform"] | null
          status: Database["public"]["Enums"]["channel_status"] | null
          token_valid: boolean | null
          workspace_id: string | null
        }
        Insert: {
          brand_id?: string | null
          connected_at?: string | null
          handle?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: Database["public"]["Enums"]["social_platform"] | null
          status?: Database["public"]["Enums"]["channel_status"] | null
          token_valid?: never
          workspace_id?: string | null
        }
        Update: {
          brand_id?: string | null
          connected_at?: string | null
          handle?: string | null
          id?: string | null
          last_synced_at?: string | null
          platform?: Database["public"]["Enums"]["social_platform"] | null
          status?: Database["public"]["Enums"]["channel_status"] | null
          token_valid?: never
          workspace_id?: string | null
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
            referencedRelation: "v_workspace_overview"
            referencedColumns: ["workspace_id"]
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
      v_workspace_overview: {
        Row: {
          brands_count: number | null
          channels_connected: number | null
          channels_count: number | null
          content_count: number | null
          jobs_pending: number | null
          missions_open: number | null
          name: string | null
          plan: Database["public"]["Enums"]["workspace_plan"] | null
          workspace_id: string | null
        }
        Insert: {
          brands_count?: never
          channels_connected?: never
          channels_count?: never
          content_count?: never
          jobs_pending?: never
          missions_open?: never
          name?: string | null
          plan?: Database["public"]["Enums"]["workspace_plan"] | null
          workspace_id?: string | null
        }
        Update: {
          brands_count?: never
          channels_connected?: never
          channels_count?: never
          content_count?: never
          jobs_pending?: never
          missions_open?: never
          name?: string | null
          plan?: Database["public"]["Enums"]["workspace_plan"] | null
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_scheduler_jobs: {
        Args: { _limit?: number; _lock_seconds?: number }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduler_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_scheduler_job: {
        Args: { _external_post_id: string; _job_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "scheduler_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_workspace_role: {
        Args: { _workspace_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      enqueue_publication: {
        Args: {
          _channel_ids: string[]
          _content_id: string
          _scheduled_at: string
        }
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "scheduler_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      fail_scheduler_job: {
        Args: { _error: string; _job_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "scheduler_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
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
      record_analytics_snapshot: {
        Args: {
          _channel_id: string
          _content_id: string
          _metrics: Json
          _workspace_id: string
        }
        Returns: {
          captured_at: string
          channel_id: string | null
          content_id: string | null
          created_at: string
          id: string
          metrics: Json
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "analytics_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_brain_memories: {
        Args: { _limit?: number; _query: string; _workspace_id: string }
        Returns: {
          content: string
          id: string
          kind: string
          metadata: Json
          similarity: number
        }[]
      }
      seed_default_templates: {
        Args: { _workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "editor" | "viewer"
      brain_event_kind:
        | "decision"
        | "result"
        | "pivot"
        | "signal"
        | "reflection"
      brain_memory_kind:
        | "fact"
        | "preference"
        | "goal"
        | "signal"
        | "outcome"
        | "strategy"
      brain_question:
        | "where_am_i"
        | "where_to_go"
        | "whats_blocking"
        | "next_action"
        | "should_pivot"
      business_path:
        | "local_business"
        | "content_creator"
        | "affiliate"
        | "digital_services"
        | "saas_builder"
        | "agency"
        | "freelancer"
        | "ecommerce"
      channel_status: "disconnected" | "connected" | "expired" | "error"
      coach_kind: "insight" | "warning" | "suggestion" | "next_action"
      coach_severity: "info" | "low" | "medium" | "high" | "critical"
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
      experience_level: "beginner" | "intermediate" | "advanced"
      health_category: "marketing" | "content" | "brand" | "channel" | "growth"
      job_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "dead_letter"
        | "cancelled"
      maturity_level: "seed" | "sprout" | "growth" | "established" | "scaling"
      mission_status: "pending" | "in_progress" | "done" | "dismissed"
      opportunity_level: "low" | "medium" | "high"
      opportunity_status:
        | "exploding"
        | "growing"
        | "stable"
        | "saturated"
        | "declining"
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
      brain_event_kind: ["decision", "result", "pivot", "signal", "reflection"],
      brain_memory_kind: [
        "fact",
        "preference",
        "goal",
        "signal",
        "outcome",
        "strategy",
      ],
      brain_question: [
        "where_am_i",
        "where_to_go",
        "whats_blocking",
        "next_action",
        "should_pivot",
      ],
      business_path: [
        "local_business",
        "content_creator",
        "affiliate",
        "digital_services",
        "saas_builder",
        "agency",
        "freelancer",
        "ecommerce",
      ],
      channel_status: ["disconnected", "connected", "expired", "error"],
      coach_kind: ["insight", "warning", "suggestion", "next_action"],
      coach_severity: ["info", "low", "medium", "high", "critical"],
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
      experience_level: ["beginner", "intermediate", "advanced"],
      health_category: ["marketing", "content", "brand", "channel", "growth"],
      job_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "dead_letter",
        "cancelled",
      ],
      maturity_level: ["seed", "sprout", "growth", "established", "scaling"],
      mission_status: ["pending", "in_progress", "done", "dismissed"],
      opportunity_level: ["low", "medium", "high"],
      opportunity_status: [
        "exploding",
        "growing",
        "stable",
        "saturated",
        "declining",
      ],
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
