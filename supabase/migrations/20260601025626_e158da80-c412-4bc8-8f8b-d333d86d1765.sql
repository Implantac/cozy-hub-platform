-- Enums
CREATE TYPE public.brain_event_kind AS ENUM ('decision','result','pivot','signal','reflection');
CREATE TYPE public.brain_question AS ENUM ('where_am_i','where_to_go','whats_blocking','next_action','should_pivot');

-- brain_memory_events
CREATE TABLE public.brain_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  kind public.brain_event_kind NOT NULL,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sentiment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brain_mem_ws_created ON public.brain_memory_events(workspace_id, created_at DESC);
CREATE INDEX idx_brain_mem_kind ON public.brain_memory_events(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_memory_events TO authenticated;
GRANT ALL ON public.brain_memory_events TO service_role;

ALTER TABLE public.brain_memory_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY bme_read ON public.brain_memory_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id) AND (user_id IS NULL OR user_id = auth.uid() OR public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role])));
CREATE POLICY bme_insert ON public.brain_memory_events FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role,'editor'::app_role]) AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY bme_delete ON public.brain_memory_events FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role]));

-- brain_snapshots
CREATE TABLE public.brain_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_brain_snap_ws ON public.brain_snapshots(workspace_id, computed_at DESC);

GRANT SELECT, INSERT, DELETE ON public.brain_snapshots TO authenticated;
GRANT ALL ON public.brain_snapshots TO service_role;

ALTER TABLE public.brain_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY bs_read ON public.brain_snapshots FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY bs_insert ON public.brain_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role,'editor'::app_role]));
CREATE POLICY bs_delete ON public.brain_snapshots FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role]));

-- brain_answers
CREATE TABLE public.brain_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  question public.brain_question NOT NULL,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX idx_brain_ans_ws_q ON public.brain_answers(workspace_id, question, computed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brain_answers TO authenticated;
GRANT ALL ON public.brain_answers TO service_role;

ALTER TABLE public.brain_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ba_read ON public.brain_answers FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY ba_write ON public.brain_answers FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role,'editor'::app_role]));
CREATE POLICY ba_update ON public.brain_answers FOR UPDATE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role,'editor'::app_role]))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role,'editor'::app_role]));
CREATE POLICY ba_delete ON public.brain_answers FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner'::app_role,'admin'::app_role]));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.brain_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brain_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.brain_memory_events;