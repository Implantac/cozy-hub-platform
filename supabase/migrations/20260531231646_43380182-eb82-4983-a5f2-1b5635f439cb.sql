
-- =====================================================================
-- DIGITAL OS · Phase 2 backend hardening (enum-corrected)
-- =====================================================================

-- 1. Unique
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'oauth_tokens_channel_unique') THEN
    ALTER TABLE public.oauth_tokens
      ADD CONSTRAINT oauth_tokens_channel_unique UNIQUE (channel_id);
  END IF;
END $$;

-- 2. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_owner();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','workspaces','brands','channels','content','content_templates',
    'scheduler_jobs','missions','integrations','oauth_tokens','brain_recommendations'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_touch_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brands_workspace ON public.brands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_brand ON public.channels(brand_id);
CREATE INDEX IF NOT EXISTS idx_channels_platform ON public.channels(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_content_workspace ON public.content(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_content_brand ON public.content(brand_id);
CREATE INDEX IF NOT EXISTS idx_jobs_due
  ON public.scheduler_jobs(status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_workspace ON public.scheduler_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_content ON public.scheduler_jobs(content_id);
CREATE INDEX IF NOT EXISTS idx_analytics_workspace ON public.analytics_snapshots(workspace_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_channel ON public.analytics_snapshots(channel_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_brain_rec_ws ON public.brain_recommendations(workspace_id, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_brain_mem_ws ON public.brain_memories(workspace_id, kind);
CREATE INDEX IF NOT EXISTS idx_missions_ws ON public.missions(workspace_id, status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_events_ws ON public.domain_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON public.domain_events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_ws ON public.audit_logs(workspace_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_brain_mem_embedding') THEN
    CREATE INDEX idx_brain_mem_embedding ON public.brain_memories
      USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;

-- 4. RLS oauth_tokens (server-only)
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oauth_tokens_no_client ON public.oauth_tokens;
CREATE POLICY oauth_tokens_no_client ON public.oauth_tokens
  FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);
REVOKE ALL ON public.oauth_tokens FROM anon, authenticated;
GRANT ALL ON public.oauth_tokens TO service_role;

-- 5. RLS faltantes
DROP POLICY IF EXISTS rec_insert ON public.brain_recommendations;
CREATE POLICY rec_insert ON public.brain_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));

DROP POLICY IF EXISTS rec_delete ON public.brain_recommendations;
CREATE POLICY rec_delete ON public.brain_recommendations
  FOR DELETE TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

DROP POLICY IF EXISTS events_insert ON public.domain_events;
CREATE POLICY events_insert ON public.domain_events
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

-- 6. RPCs (enums: pending, processing, succeeded, failed, dead_letter, cancelled)
CREATE OR REPLACE FUNCTION public.enqueue_publication(
  _content_id uuid, _channel_ids uuid[], _scheduled_at timestamptz
) RETURNS SETOF public.scheduler_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ws uuid; v_channel uuid; v_job public.scheduler_jobs;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.content WHERE id = _content_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'content not found'; END IF;
  IF NOT public.has_workspace_role(v_ws, ARRAY['owner','admin','editor']::app_role[]) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _scheduled_at < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'scheduled_at must be in the future';
  END IF;

  FOREACH v_channel IN ARRAY _channel_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = v_channel AND workspace_id = v_ws) THEN
      RAISE EXCEPTION 'channel % not in workspace', v_channel;
    END IF;
    INSERT INTO public.scheduler_jobs(workspace_id, content_id, channel_id, scheduled_at, status)
    VALUES (v_ws, _content_id, v_channel, _scheduled_at, 'pending')
    RETURNING * INTO v_job;
    RETURN NEXT v_job;
  END LOOP;

  UPDATE public.content SET status = 'scheduled' WHERE id = _content_id AND status = 'draft';

  INSERT INTO public.domain_events(workspace_id, event_type, payload)
  VALUES (v_ws, 'content.scheduled',
    jsonb_build_object('content_id', _content_id, 'channel_ids', _channel_ids, 'scheduled_at', _scheduled_at));
END $$;
REVOKE ALL ON FUNCTION public.enqueue_publication(uuid, uuid[], timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_publication(uuid, uuid[], timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_scheduler_jobs(_limit int DEFAULT 10, _lock_seconds int DEFAULT 60)
RETURNS SETOF public.scheduler_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH ready AS (
    SELECT id FROM public.scheduler_jobs
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY scheduled_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.scheduler_jobs j
  SET status = 'processing',
      locked_until = now() + make_interval(secs => _lock_seconds),
      attempts = j.attempts + 1,
      run_at = now()
  FROM ready
  WHERE j.id = ready.id
  RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_scheduler_jobs(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_scheduler_jobs(int, int) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_scheduler_job(_job_id uuid, _external_post_id text)
RETURNS public.scheduler_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.scheduler_jobs;
BEGIN
  UPDATE public.scheduler_jobs
  SET status='succeeded', external_post_id=_external_post_id, last_error=NULL, locked_until=NULL
  WHERE id=_job_id RETURNING * INTO v;
  IF v.id IS NOT NULL THEN
    UPDATE public.content SET status='published' WHERE id = v.content_id;
    INSERT INTO public.domain_events(workspace_id,event_type,payload)
    VALUES (v.workspace_id,'content.published',
      jsonb_build_object('job_id',v.id,'content_id',v.content_id,'channel_id',v.channel_id,'external_post_id',_external_post_id));
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.complete_scheduler_job(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_scheduler_job(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_scheduler_job(_job_id uuid, _error text)
RETURNS public.scheduler_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.scheduler_jobs;
BEGIN
  UPDATE public.scheduler_jobs
  SET status = CASE WHEN attempts >= max_attempts THEN 'dead_letter'::job_status ELSE 'pending'::job_status END,
      last_error = _error,
      locked_until = NULL,
      scheduled_at = CASE
        WHEN attempts < max_attempts
        THEN now() + (power(2, attempts) * interval '30 seconds')
        ELSE scheduled_at END
  WHERE id = _job_id RETURNING * INTO v;
  IF v.id IS NOT NULL THEN
    INSERT INTO public.domain_events(workspace_id,event_type,payload)
    VALUES (v.workspace_id,
      CASE WHEN v.status='dead_letter' THEN 'content.publish_dead_letter' ELSE 'content.publish_retry' END,
      jsonb_build_object('job_id',v.id,'error',_error,'attempts',v.attempts));
  END IF;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.fail_scheduler_job(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_scheduler_job(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_analytics_snapshot(
  _workspace_id uuid, _channel_id uuid, _content_id uuid, _metrics jsonb
) RETURNS public.analytics_snapshots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.analytics_snapshots;
BEGIN
  IF _metrics IS NULL OR jsonb_typeof(_metrics) <> 'object' THEN
    RAISE EXCEPTION 'metrics must be an object';
  END IF;
  INSERT INTO public.analytics_snapshots(workspace_id, channel_id, content_id, metrics)
  VALUES (_workspace_id, _channel_id, _content_id, _metrics)
  RETURNING * INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.record_analytics_snapshot(uuid,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_analytics_snapshot(uuid,uuid,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.search_brain_memories(
  _workspace_id uuid, _query vector(1536), _limit int DEFAULT 8
) RETURNS TABLE(id uuid, content text, kind text, similarity float, metadata jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_member(_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT m.id, m.content, m.kind::text,
           1 - (m.embedding <=> _query) AS similarity,
           m.metadata
    FROM public.brain_memories m
    WHERE m.workspace_id = _workspace_id AND m.embedding IS NOT NULL
    ORDER BY m.embedding <=> _query
    LIMIT _limit;
END $$;
REVOKE ALL ON FUNCTION public.search_brain_memories(uuid, vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_brain_memories(uuid, vector, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_default_templates(_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workspace_member(_workspace_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.content_templates(workspace_id, name, body, variables, tags)
  VALUES
    (_workspace_id, 'Post · Anúncio',
      E'🚀 {{titulo}}\n\n{{descricao}}\n\n👉 {{cta}}\n\n{{hashtags}}',
      '["titulo","descricao","cta","hashtags"]'::jsonb, ARRAY['post','anuncio']),
    (_workspace_id, 'Story · Bastidores',
      E'{{cena}} — {{insight_curto}}',
      '["cena","insight_curto"]'::jsonb, ARRAY['story','bastidores']),
    (_workspace_id, 'Reel · Gancho 3s',
      E'Gancho: {{gancho}}\nMeio: {{desenvolvimento}}\nFim: {{cta}}',
      '["gancho","desenvolvimento","cta"]'::jsonb, ARRAY['reel','video']),
    (_workspace_id, 'Carrossel · 5 slides',
      E'1. {{slide1}}\n2. {{slide2}}\n3. {{slide3}}\n4. {{slide4}}\n5. {{slide5}}',
      '["slide1","slide2","slide3","slide4","slide5"]'::jsonb, ARRAY['carrossel'])
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.seed_default_templates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_templates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_workspace_seed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.content_templates(workspace_id, name, body, variables, tags)
  VALUES
    (NEW.id, 'Post · Anúncio',
      E'🚀 {{titulo}}\n\n{{descricao}}\n\n👉 {{cta}}\n\n{{hashtags}}',
      '["titulo","descricao","cta","hashtags"]'::jsonb, ARRAY['post','anuncio']),
    (NEW.id, 'Story · Bastidores',
      E'{{cena}} — {{insight_curto}}',
      '["cena","insight_curto"]'::jsonb, ARRAY['story','bastidores']),
    (NEW.id, 'Reel · Gancho 3s',
      E'Gancho: {{gancho}}\nMeio: {{desenvolvimento}}\nFim: {{cta}}',
      '["gancho","desenvolvimento","cta"]'::jsonb, ARRAY['reel','video']),
    (NEW.id, 'Carrossel · 5 slides',
      E'1. {{slide1}}\n2. {{slide2}}\n3. {{slide3}}\n4. {{slide4}}\n5. {{slide5}}',
      '["slide1","slide2","slide3","slide4","slide5"]'::jsonb, ARRAY['carrossel']);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_workspace_seed ON public.workspaces;
CREATE TRIGGER on_workspace_seed
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_workspace_seed();

-- 7. Views (mission_status: pending, in_progress, done, dismissed)
CREATE OR REPLACE VIEW public.v_workspace_overview
WITH (security_invoker = true) AS
SELECT
  w.id AS workspace_id, w.name, w.plan,
  (SELECT count(*) FROM public.brands b WHERE b.workspace_id = w.id) AS brands_count,
  (SELECT count(*) FROM public.channels c WHERE c.workspace_id = w.id) AS channels_count,
  (SELECT count(*) FROM public.channels c WHERE c.workspace_id = w.id AND c.status='connected') AS channels_connected,
  (SELECT count(*) FROM public.content ct WHERE ct.workspace_id = w.id) AS content_count,
  (SELECT count(*) FROM public.scheduler_jobs j
     WHERE j.workspace_id = w.id AND j.status = 'pending') AS jobs_pending,
  (SELECT count(*) FROM public.missions m
     WHERE m.workspace_id = w.id AND m.status NOT IN ('done','dismissed')) AS missions_open
FROM public.workspaces w;
GRANT SELECT ON public.v_workspace_overview TO authenticated;

CREATE OR REPLACE VIEW public.v_channel_health
WITH (security_invoker = true) AS
SELECT
  c.id, c.workspace_id, c.brand_id, c.platform, c.status, c.handle,
  c.last_synced_at, c.connected_at,
  EXISTS (SELECT 1 FROM public.oauth_tokens t
          WHERE t.channel_id = c.id AND (t.expires_at IS NULL OR t.expires_at > now())) AS token_valid
FROM public.channels c;
GRANT SELECT ON public.v_channel_health TO authenticated;

-- 8. Realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['missions','scheduler_jobs','brain_recommendations','domain_events'] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
