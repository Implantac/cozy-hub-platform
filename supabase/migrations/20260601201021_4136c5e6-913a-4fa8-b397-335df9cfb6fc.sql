
-- Trend & threat enums
CREATE TYPE public.competitor_trend AS ENUM ('up', 'down', 'flat');
CREATE TYPE public.competitor_threat AS ENUM ('high', 'medium', 'low');

-- Competitors
CREATE TABLE public.competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  handle text,
  url text,
  followers integer NOT NULL DEFAULT 0,
  engagement numeric NOT NULL DEFAULT 0,
  trend public.competitor_trend NOT NULL DEFAULT 'flat',
  threat public.competitor_threat NOT NULL DEFAULT 'medium',
  positioning text,
  recent_move text,
  gap text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitors TO authenticated;
GRANT ALL ON public.competitors TO service_role;

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY comp_read ON public.competitors FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY comp_write ON public.competitors FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));
CREATE POLICY comp_update ON public.competitors FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));
CREATE POLICY comp_delete ON public.competitors FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE INDEX competitors_workspace_idx ON public.competitors(workspace_id);

-- Business blueprints (one per workspace)
CREATE TABLE public.business_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  problem text,
  audience text,
  promise text,
  differentiator text,
  offer text,
  price text,
  channels text,
  content_pillars text,
  funnel text,
  metric text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_blueprints TO authenticated;
GRANT ALL ON public.business_blueprints TO service_role;

ALTER TABLE public.business_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY bp_read ON public.business_blueprints FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY bp_write ON public.business_blueprints FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));
CREATE POLICY bp_update ON public.business_blueprints FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));
CREATE POLICY bp_delete ON public.business_blueprints FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role]));
