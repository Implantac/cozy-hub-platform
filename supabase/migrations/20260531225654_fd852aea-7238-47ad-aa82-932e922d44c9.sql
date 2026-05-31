
-- =========================================================
-- DIGITAL OS — Foundation Schema (Phase 1)
-- Multi-tenant (workspace-scoped) + RBAC + pgvector + audit
-- =========================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.workspace_plan AS ENUM ('free', 'pro', 'business', 'enterprise');
CREATE TYPE public.social_platform AS ENUM ('instagram','facebook','youtube','tiktok','linkedin');
CREATE TYPE public.channel_status AS ENUM ('disconnected','connected','expired','error');
CREATE TYPE public.content_type AS ENUM ('post','reel','story','short','video','article','carousel');
CREATE TYPE public.content_status AS ENUM ('draft','scheduled','publishing','published','failed','archived');
CREATE TYPE public.job_status AS ENUM ('pending','processing','succeeded','failed','dead_letter','cancelled');
CREATE TYPE public.mission_status AS ENUM ('pending','in_progress','done','dismissed');
CREATE TYPE public.recommendation_status AS ENUM ('open','applied','dismissed','expired');
CREATE TYPE public.brain_memory_kind AS ENUM ('fact','preference','goal','signal','outcome','strategy');

-- =========================================================
-- PROFILES (1:1 with auth.users)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  default_workspace_id UUID,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- WORKSPACES (tenants)
-- =========================================================
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan public.workspace_plan NOT NULL DEFAULT 'free',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT ALL ON public.workspaces TO service_role;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- WORKSPACE_MEMBERS (RBAC pivot)
-- =========================================================
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX idx_wm_workspace ON public.workspace_members(workspace_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- AUTHZ HELPERS (SECURITY DEFINER to avoid RLS recursion)
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id UUID, _roles public.app_role[], _user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role(_workspace_id UUID)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- =========================================================
-- TRIGGERS: auto-create profile + auto-create owner membership
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_workspace_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_owner();

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================
-- BRANDS
-- =========================================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  voice JSONB NOT NULL DEFAULT '{}'::jsonb,
  palette JSONB NOT NULL DEFAULT '{}'::jsonb,
  logo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_brands_ws ON public.brands(workspace_id);
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- CHANNELS (social channel connections)
-- =========================================================
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  platform public.social_platform NOT NULL,
  handle TEXT,
  external_id TEXT,
  status public.channel_status NOT NULL DEFAULT 'disconnected',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform, external_id)
);
CREATE INDEX idx_channels_ws ON public.channels(workspace_id);
CREATE INDEX idx_channels_brand ON public.channels(brand_id);
CREATE TRIGGER trg_channels_updated BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- OAUTH_TOKENS (encrypted secrets — service_role ONLY)
-- =========================================================
CREATE TABLE public.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  token_type TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oauth_channel ON public.oauth_tokens(channel_id);
-- No authenticated grant: tokens only accessible via service_role / server fns
GRANT ALL ON public.oauth_tokens TO service_role;
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- CONTENT
-- =========================================================
CREATE TABLE public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  type public.content_type NOT NULL DEFAULT 'post',
  title TEXT,
  body TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.content_status NOT NULL DEFAULT 'draft',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_content_ws ON public.content(workspace_id);
CREATE INDEX idx_content_brand ON public.content(brand_id);
CREATE INDEX idx_content_status ON public.content(workspace_id, status);
CREATE TRIGGER trg_content_updated BEFORE UPDATE ON public.content FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content TO authenticated;
GRANT ALL ON public.content TO service_role;
ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- CONTENT_TEMPLATES
-- =========================================================
CREATE TABLE public.content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_templates_ws ON public.content_templates(workspace_id);
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.content_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_templates TO authenticated;
GRANT ALL ON public.content_templates TO service_role;
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SCHEDULER_JOBS (queue with retry + DLQ)
-- =========================================================
CREATE TABLE public.scheduler_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  last_error TEXT,
  external_post_id TEXT,
  run_at TIMESTAMPTZ,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_status_due ON public.scheduler_jobs(status, scheduled_at) WHERE status IN ('pending','processing');
CREATE INDEX idx_jobs_ws ON public.scheduler_jobs(workspace_id);
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.scheduler_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduler_jobs TO authenticated;
GRANT ALL ON public.scheduler_jobs TO service_role;
ALTER TABLE public.scheduler_jobs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- ANALYTICS_SNAPSHOTS
-- =========================================================
CREATE TABLE public.analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_ws_time ON public.analytics_snapshots(workspace_id, captured_at DESC);
CREATE INDEX idx_analytics_channel ON public.analytics_snapshots(channel_id, captured_at DESC);
GRANT SELECT, INSERT ON public.analytics_snapshots TO authenticated;
GRANT ALL ON public.analytics_snapshots TO service_role;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- BRAIN_MEMORIES (pgvector for RAG)
-- =========================================================
CREATE TABLE public.brain_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind public.brain_memory_kind NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_memories_ws ON public.brain_memories(workspace_id);
CREATE INDEX idx_memories_embedding ON public.brain_memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
GRANT SELECT, INSERT, DELETE ON public.brain_memories TO authenticated;
GRANT ALL ON public.brain_memories TO service_role;
ALTER TABLE public.brain_memories ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- BRAIN_RECOMMENDATIONS
-- =========================================================
CREATE TABLE public.brain_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(5,4) NOT NULL DEFAULT 0,
  status public.recommendation_status NOT NULL DEFAULT 'open',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recs_ws_status ON public.brain_recommendations(workspace_id, status);
CREATE TRIGGER trg_recs_updated BEFORE UPDATE ON public.brain_recommendations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_recommendations TO authenticated;
GRANT ALL ON public.brain_recommendations TO service_role;
ALTER TABLE public.brain_recommendations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- MISSIONS
-- =========================================================
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.mission_status NOT NULL DEFAULT 'pending',
  priority INT NOT NULL DEFAULT 0,
  assigned_to UUID REFERENCES auth.users(id),
  due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_missions_ws ON public.missions(workspace_id, status);
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missions TO authenticated;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- INTEGRATIONS (third-party integration configs)
-- =========================================================
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider)
);
CREATE INDEX idx_integrations_ws ON public.integrations(workspace_id);
CREATE TRIGGER trg_integrations_updated BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- AUDIT_LOGS (append-only)
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_ws_time ON public.audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- DOMAIN_EVENTS (event-driven outbox)
-- =========================================================
CREATE TABLE public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_unprocessed ON public.domain_events(created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_events_ws_type ON public.domain_events(workspace_id, event_type, created_at DESC);
GRANT SELECT ON public.domain_events TO authenticated;
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles: each user owns their row
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- workspaces: members can read; owner can update/delete; any user can create (becomes owner via trigger)
CREATE POLICY "ws_select_member" ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));
CREATE POLICY "ws_insert_self_owner" ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "ws_update_admin" ON public.workspaces FOR UPDATE TO authenticated
  USING (public.has_workspace_role(id, ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_workspace_role(id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "ws_delete_owner" ON public.workspaces FOR DELETE TO authenticated
  USING (public.has_workspace_role(id, ARRAY['owner']::public.app_role[]));

-- workspace_members
CREATE POLICY "wm_select_self_or_admin" ON public.workspace_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "wm_insert_admin" ON public.workspace_members FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "wm_update_admin" ON public.workspace_members FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "wm_delete_admin_or_self" ON public.workspace_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- Generic tenant-scoped policies (helper macro pattern, inlined)
-- brands
CREATE POLICY "brands_read" ON public.brands FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "brands_write" ON public.brands FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "brands_update" ON public.brands FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "brands_delete" ON public.brands FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- channels
CREATE POLICY "channels_read" ON public.channels FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "channels_write" ON public.channels FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "channels_update" ON public.channels FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "channels_delete" ON public.channels FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- oauth_tokens: NO authenticated policies (service_role only)

-- content
CREATE POLICY "content_read" ON public.content FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "content_write" ON public.content FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "content_update" ON public.content FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "content_delete" ON public.content FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));

-- content_templates
CREATE POLICY "tpl_read" ON public.content_templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "tpl_write" ON public.content_templates FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "tpl_update" ON public.content_templates FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "tpl_delete" ON public.content_templates FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));

-- scheduler_jobs
CREATE POLICY "jobs_read" ON public.scheduler_jobs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "jobs_write" ON public.scheduler_jobs FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "jobs_update" ON public.scheduler_jobs FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "jobs_delete" ON public.scheduler_jobs FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- analytics
CREATE POLICY "analytics_read" ON public.analytics_snapshots FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "analytics_insert" ON public.analytics_snapshots FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));

-- brain_memories
CREATE POLICY "mem_read" ON public.brain_memories FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "mem_insert" ON public.brain_memories FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "mem_delete" ON public.brain_memories FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- brain_recommendations
CREATE POLICY "rec_read" ON public.brain_recommendations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "rec_update" ON public.brain_recommendations FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));

-- missions
CREATE POLICY "missions_read" ON public.missions FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "missions_write" ON public.missions FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "missions_update" ON public.missions FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::public.app_role[]));
CREATE POLICY "missions_delete" ON public.missions FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- integrations
CREATE POLICY "integrations_read" ON public.integrations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id));
CREATE POLICY "integrations_write" ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "integrations_update" ON public.integrations FOR UPDATE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[])) WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "integrations_delete" ON public.integrations FOR DELETE TO authenticated USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));

-- audit_logs: read-own-workspace; admins see all in ws
CREATE POLICY "audit_read" ON public.audit_logs FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.app_role[]));
CREATE POLICY "audit_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id)));

-- domain_events: read by members (debugging/feed)
CREATE POLICY "events_read" ON public.domain_events FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- profiles trigger touches updated_at
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_workspaces_updated BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
