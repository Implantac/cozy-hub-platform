-- Business Validations
CREATE TABLE public.business_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  idea TEXT NOT NULL,
  business_model TEXT,
  target_audience TEXT,
  market_demand_score INTEGER NOT NULL DEFAULT 0,
  competition_score INTEGER NOT NULL DEFAULT 0,
  complexity_score INTEGER NOT NULL DEFAULT 0,
  opportunity_score INTEGER NOT NULL DEFAULT 0,
  verdict TEXT NOT NULL DEFAULT 'inconclusive',
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.business_validations TO authenticated;
GRANT ALL ON public.business_validations TO service_role;

ALTER TABLE public.business_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY bv_read ON public.business_validations
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

CREATE POLICY bv_write ON public.business_validations
  FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));

CREATE POLICY bv_delete ON public.business_validations
  FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE INDEX idx_business_validations_ws ON public.business_validations(workspace_id, created_at DESC);

-- Reality Checks
CREATE TABLE public.reality_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  change_type TEXT NOT NULL,
  current_state TEXT NOT NULL,
  proposed_change TEXT NOT NULL,
  caution_level TEXT NOT NULL DEFAULT 'yellow',
  indicators_positive JSONB NOT NULL DEFAULT '[]'::jsonb,
  indicators_warning JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions_to_answer JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  ai_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.reality_checks TO authenticated;
GRANT ALL ON public.reality_checks TO service_role;

ALTER TABLE public.reality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY rc_read ON public.reality_checks
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

CREATE POLICY rc_write ON public.reality_checks
  FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role, 'editor'::app_role]));

CREATE POLICY rc_delete ON public.reality_checks
  FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role]));

CREATE INDEX idx_reality_checks_ws ON public.reality_checks(workspace_id, created_at DESC);