-- Brain-2A: Digital Twin + Skill Map + Experiments + Decisions foundation
-- We bundle 2A+2B schema together so engines can be wired without a second approval pause.

-- =========================================================
-- 1. DIGITAL TWIN: behavioral profile (extends user_profile_digital)
-- =========================================================
CREATE TABLE public.digital_twins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  -- Behavioral capture
  work_style text,                        -- 'solo','team','agency'
  daily_hours numeric DEFAULT 1,          -- hours/day available
  avoided_formats text[] DEFAULT '{}',    -- ['video','live']
  preferred_formats text[] DEFAULT '{}',  -- ['text','carousel']
  audience_type text,                     -- 'local','national','global','b2b','b2c'
  best_channel text,                      -- 'instagram','linkedin','youtube'
  pain_points text[] DEFAULT '{}',        -- ['prospecting','consistency']
  strengths text[] DEFAULT '{}',
  monetization_model text,                -- 'services','products','affiliate','saas','content'
  -- Inferred attributes (engine-updated)
  inferred jsonb NOT NULL DEFAULT '{}'::jsonb,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,  -- timeline of behavioral observations
  -- Meta
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_twins TO authenticated;
GRANT ALL ON public.digital_twins TO service_role;

ALTER TABLE public.digital_twins ENABLE ROW LEVEL SECURITY;

CREATE POLICY twin_select ON public.digital_twins FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY twin_insert ON public.digital_twins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY twin_update ON public.digital_twins FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_workspace_member(workspace_id))
  WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY twin_delete ON public.digital_twins FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER touch_digital_twins BEFORE UPDATE ON public.digital_twins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 2. SKILL MAP
-- =========================================================
CREATE TYPE public.skill_area AS ENUM (
  'content','copy','sales','prospecting','branding',
  'automation','analytics','strategy','community','product'
);

CREATE TABLE public.skill_assessments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  area public.skill_area NOT NULL,
  score int NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  confidence numeric NOT NULL DEFAULT 0.5,
  source text NOT NULL DEFAULT 'self',     -- 'self','inferred','assessment'
  notes text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_assessments TO authenticated;
GRANT ALL ON public.skill_assessments TO service_role;

ALTER TABLE public.skill_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_select ON public.skill_assessments FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY skill_write ON public.skill_assessments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_workspace_member(workspace_id));
CREATE POLICY skill_update ON public.skill_assessments FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY skill_delete ON public.skill_assessments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 3. EXPERIMENTS (Brain-2B)
-- =========================================================
CREATE TYPE public.experiment_status AS ENUM (
  'proposed','active','succeeded','neutral','failed','cancelled'
);

CREATE TABLE public.brain_experiments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid,
  title text NOT NULL,
  hypothesis text NOT NULL,
  area public.skill_area,
  status public.experiment_status NOT NULL DEFAULT 'proposed',
  metric_name text,                       -- 'engagement','leads','followers'
  metric_baseline numeric,
  metric_target numeric,
  metric_result numeric,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_days int DEFAULT 7,
  effort_level text DEFAULT 'medium',     -- 'low','medium','high'
  notes text,
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_experiments TO authenticated;
GRANT ALL ON public.brain_experiments TO service_role;

ALTER TABLE public.brain_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY exp_read ON public.brain_experiments FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY exp_write ON public.brain_experiments FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY exp_update ON public.brain_experiments FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY exp_delete ON public.brain_experiments FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER touch_brain_experiments BEFORE UPDATE ON public.brain_experiments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4. DECISIONS (Brain-2B)
-- =========================================================
CREATE TYPE public.decision_status AS ENUM (
  'draft','evaluated','approved','rejected','executed','reverted'
);

CREATE TABLE public.brain_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid,
  title text NOT NULL,
  category text NOT NULL,                 -- 'spend','hire','pivot','channel','offer','product'
  description text,
  cost_estimate numeric DEFAULT 0,
  expected_benefit text,
  status public.decision_status NOT NULL DEFAULT 'draft',
  evaluation jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {benefits,risks,signals_positive,signals_negative,recommendation,confidence,scenarios}
  outcome jsonb NOT NULL DEFAULT '{}'::jsonb,     -- what actually happened
  outcome_score int,                      -- -100..100
  decided_at timestamptz,
  executed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_decisions TO authenticated;
GRANT ALL ON public.brain_decisions TO service_role;

ALTER TABLE public.brain_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY dec_read ON public.brain_decisions FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY dec_write ON public.brain_decisions FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY dec_update ON public.brain_decisions FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]))
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY dec_delete ON public.brain_decisions FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

CREATE TRIGGER touch_brain_decisions BEFORE UPDATE ON public.brain_decisions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 5. DUE DILIGENCE REPORTS (Brain-2D anti-scam)
-- =========================================================
CREATE TABLE public.due_diligence_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  user_id uuid,
  target_type text NOT NULL,              -- 'course','mentor','software','vendor'
  target_name text NOT NULL,
  source_url text,
  raw_input text,
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {company_identified,support_visible,refund_policy,public_reputation,red_flags,green_flags}
  risk_score int NOT NULL DEFAULT 50,    -- 0 safe .. 100 risky
  verdict text NOT NULL DEFAULT 'inconclusive',  -- 'safe','caution','risky','inconclusive'
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.due_diligence_reports TO authenticated;
GRANT ALL ON public.due_diligence_reports TO service_role;

ALTER TABLE public.due_diligence_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY ddr_read ON public.due_diligence_reports FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY ddr_write ON public.due_diligence_reports FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY ddr_delete ON public.due_diligence_reports FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

-- =========================================================
-- 6. HEALTH 360 — extend health_category enum (Brain-2D)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_category') THEN
    NULL;
  ELSE
    -- Add new pillars if not present
    BEGIN ALTER TYPE public.health_category ADD VALUE IF NOT EXISTS 'sales'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.health_category ADD VALUE IF NOT EXISTS 'positioning'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.health_category ADD VALUE IF NOT EXISTS 'operations'; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER TYPE public.health_category ADD VALUE IF NOT EXISTS 'learning'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END$$;

-- =========================================================
-- 7. AI COUNCIL OPINIONS (Brain-2C)
-- =========================================================
CREATE TYPE public.advisor_role AS ENUM (
  'marketing','content','business','financial','strategy'
);

CREATE TABLE public.council_opinions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  advisor public.advisor_role NOT NULL,
  topic text NOT NULL,                    -- the question/context
  summary text NOT NULL,
  analysis text,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0.5,
  model_used text,
  inputs_hash text,                       -- to dedupe identical asks
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.council_opinions TO authenticated;
GRANT ALL ON public.council_opinions TO service_role;

ALTER TABLE public.council_opinions ENABLE ROW LEVEL SECURITY;

CREATE POLICY co_read ON public.council_opinions FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));
CREATE POLICY co_write ON public.council_opinions FOR INSERT TO authenticated
  WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY co_delete ON public.council_opinions FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

CREATE INDEX idx_council_opinions_ws_advisor ON public.council_opinions(workspace_id, advisor, created_at DESC);
CREATE INDEX idx_brain_experiments_ws_status ON public.brain_experiments(workspace_id, status);
CREATE INDEX idx_brain_decisions_ws_status ON public.brain_decisions(workspace_id, status, created_at DESC);
CREATE INDEX idx_digital_twins_user_ws ON public.digital_twins(user_id, workspace_id);
CREATE INDEX idx_skill_assessments_user_area ON public.skill_assessments(user_id, area);
CREATE INDEX idx_ddr_ws ON public.due_diligence_reports(workspace_id, created_at DESC);
