-- Replace the public Supabase publishable key used by the earlier analytics
-- schedule with a dedicated server-only cron secret. The endpoint no longer
-- accepts `apikey` as authentication: publishable keys are public by design.
--
-- Configure `app.settings.cron_secret` (at least 32 characters) and
-- `app.settings.app_url` in the database environment before applying this
-- migration. If the secret is missing/weak, the old job is removed and the
-- analytics job remains disabled rather than retaining a public credential.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  base_url text := coalesce(
    current_setting('app.settings.app_url', true),
    'https://cozy-hub-platform.lovable.app'
  );
  cron_secret text := coalesce(current_setting('app.settings.cron_secret', true), '');
begin
  perform cron.unschedule('velt-analytics-sync')
  where exists (select 1 from cron.job where jobname = 'velt-analytics-sync');

  if length(cron_secret) < 32 then
    raise notice 'velt-analytics-sync desativado: configure app.settings.cron_secret (mínimo 32 caracteres) e reaplique esta migration.';
    return;
  end if;

  perform cron.schedule(
    'velt-analytics-sync',
    '0 */6 * * *',
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
      $job$,
      base_url || '/api/public/cron/analytics-sync',
      cron_secret
    )
  );

  raise notice 'velt-analytics-sync protegido por segredo dedicado e agendado a cada 6 horas em %', base_url;
end
$$;
