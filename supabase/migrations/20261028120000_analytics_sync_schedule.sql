-- =========================================================
-- VELT — Metric collection schedule
--
-- Closes the loop opened by migration 14: `analytics_snapshots` existed but
-- nothing ever wrote to it, so best-time-to-post could only ever return
-- baselines and the Brain's growth engine was blind to real trends.
--
-- Cadence rationale: platform insight endpoints are quota-bound and per-post
-- counters plateau within a day. Every 6 hours captures the first-day spike
-- without wasting provider quota. The scheduler tick stays at 1 minute —
-- publishing needs to be timely; measurement does not.
--
-- Both jobs call the same shared-secret gate used by the existing cron:
--   header  apikey: <SUPABASE_PUBLISHABLE_KEY>
-- The URL is resolved at runtime from app.settings so this migration works in
-- any environment without hardcoding a project ref.
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Fail soft: the migration must not block a deploy when the URL setting is
-- absent (fresh local stack). The manual "Medir agora" button still works.
do $$
declare
  base_url text := coalesce(
    current_setting('app.settings.app_url', true),
    'https://cozy-hub-platform.lovable.app'
  );
  anon_key text := coalesce(
    current_setting('app.settings.anon_key', true),
    ''
  );
begin
  -- Drop any previous schedule with the same name so re-running is idempotent.
  perform cron.unschedule('velt-analytics-sync')
  where exists (select 1 from cron.job where jobname = 'velt-analytics-sync');

  if anon_key = '' then
    raise notice 'velt-analytics-sync não agendado: app.settings.anon_key ausente. Use o botão "Medir agora" ou configure a setting.';
    return;
  end if;

  perform cron.schedule(
    'velt-analytics-sync',
    '0 */6 * * *',  -- a cada 6 horas
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', %L
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$,
      base_url || '/api/public/cron/analytics-sync',
      anon_key
    )
  );

  raise notice 'velt-analytics-sync agendado a cada 6 horas em %', base_url;
end
$$;

-- ---------------------------------------------------------
-- Observability: a compact view over collection health.
-- Used by support to answer "por que os gráficos estão vazios?"
-- without reading five tables by hand.
-- ---------------------------------------------------------
create or replace view public.velt_metrics_health as
select
  c.workspace_id,
  c.platform,
  c.status                                   as channel_status,
  c.last_synced_at,
  count(distinct j.id)                       as published_posts,
  count(distinct s.id)                       as snapshots,
  max(s.captured_at)                         as last_snapshot_at,
  case
    when c.status <> 'connected' then 'canal não conectado'
    when c.last_synced_at is null then 'nunca sincronizado'
    when c.last_synced_at < now() - interval '24 hours' then 'sincronização atrasada'
    when count(distinct s.id) = 0 then 'sem snapshots'
    else 'ok'
  end                                        as health
from public.channels c
left join public.scheduler_jobs j
  on j.channel_id = c.id
 and j.status = 'succeeded'
 and j.external_post_id is not null
left join public.analytics_snapshots s
  on s.channel_id = c.id
group by c.workspace_id, c.platform, c.status, c.last_synced_at;

comment on view public.velt_metrics_health is
  'Saúde da coleta de métricas por canal. Alimenta o diagnóstico de gráficos vazios.';

-- Views respect RLS of their base tables only when security_invoker is on.
alter view public.velt_metrics_health set (security_invoker = on);
