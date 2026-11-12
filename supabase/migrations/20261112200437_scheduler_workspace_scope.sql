-- A manual tick is tenant-scoped; cron keeps the original global service-role RPC.
create or replace function public.claim_workspace_scheduler_jobs(
  _workspace_id uuid,_limit integer default 10,_lock_seconds integer default 60
) returns setof public.scheduler_jobs
language plpgsql security definer set search_path = public as $$
begin
  if _workspace_id is null or _limit is null or _limit not between 1 and 50 or
     _lock_seconds is null or _lock_seconds not between 1 and 3600 then
    raise exception 'Invalid workspace claim parameters';
  end if;
  return query
  with ready as (
    select id from public.scheduler_jobs where workspace_id=_workspace_id
      and status='pending' and scheduled_at<=now()
      and (locked_until is null or locked_until<now())
    order by scheduled_at,id limit _limit for update skip locked
  )
  update public.scheduler_jobs j set status='processing',
    locked_until=now()+make_interval(secs=>_lock_seconds),attempts=j.attempts+1,run_at=now()
  from ready where j.id=ready.id returning j.*;
end $$;
revoke all on function public.claim_workspace_scheduler_jobs(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_workspace_scheduler_jobs(uuid,integer,integer) to service_role;

-- Serialize scheduling per content, reject duplicates/empty sets and disconnected
-- registrations. A manual channel registration is not an OAuth connection.
create unique index scheduler_jobs_active_content_channel_key
  on public.scheduler_jobs(content_id,channel_id) where status in ('pending','processing');
create or replace function public.enqueue_publication(
  _content_id uuid,_channel_ids uuid[],_scheduled_at timestamptz
) returns setof public.scheduler_jobs
language plpgsql security definer set search_path = public as $$
declare item public.content; channel_uuid uuid;
begin
  if _channel_ids is null or cardinality(_channel_ids) not between 1 and 20 or
     exists(select 1 from unnest(_channel_ids) x where x is null) or
     (select count(distinct x) from unnest(_channel_ids) x) <> cardinality(_channel_ids) then
    raise exception 'Selecione de 1 a 20 canais distintos.';
  end if;
  if _scheduled_at is null or _scheduled_at < now() then
    raise exception 'Escolha um horário futuro para o agendamento.';
  end if;
  select * into item from public.content where id=_content_id for update;
  if item.id is null then raise exception 'Conteúdo não encontrado.'; end if;
  if not public.has_workspace_role(item.workspace_id,array['owner','admin','editor']::public.app_role[]) then
    raise exception using errcode='42501',message='forbidden: insufficient role to schedule content';
  end if;
  if item.status not in ('draft','failed') or exists(
    select 1 from public.scheduler_jobs where content_id=item.id and status in ('pending','processing')
  ) then raise exception 'O conteúdo já está agendado ou precisa voltar a rascunho.'; end if;
  foreach channel_uuid in array _channel_ids loop
    if not exists(select 1 from public.channels c where c.id=channel_uuid
      and c.workspace_id=item.workspace_id and c.status='connected'
      and exists(select 1 from public.oauth_tokens t where t.channel_id=c.id)) then
      raise exception 'Conecte ou reconecte todos os canais neste workspace antes de agendar.';
    end if;
  end loop;
  return query insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at,status)
    select item.workspace_id,item.id,x,_scheduled_at,'pending'::public.job_status from unnest(_channel_ids) x
    returning *;
  update public.content set status='scheduled' where id=item.id;
  insert into public.domain_events(workspace_id,event_type,payload) values
    (item.workspace_id,'content.scheduled',jsonb_build_object('content_id',item.id,'channel_ids',_channel_ids,'scheduled_at',_scheduled_at));
end $$;
revoke all on function public.enqueue_publication(uuid,uuid[],timestamptz) from public,anon;
grant execute on function public.enqueue_publication(uuid,uuid[],timestamptz) to authenticated;

-- Only the trusted lifecycle RPCs can enqueue or change delivery status.
-- An editor must not manufacture a succeeded/external_post_id row through REST.
drop policy jobs_write on public.scheduler_jobs;
drop policy jobs_update on public.scheduler_jobs;

create or replace function public.cancel_publication(_workspace_id uuid,_job_id uuid)
returns public.scheduler_jobs
language plpgsql security definer set search_path = public as $$
declare content_uuid uuid; result public.scheduler_jobs;
begin
  if not public.has_workspace_role(_workspace_id,array['owner','admin','editor']::public.app_role[]) then
    raise exception using errcode='42501',message='forbidden: insufficient role to cancel a publication';
  end if;
  select content_id into content_uuid from public.scheduler_jobs
    where id=_job_id and workspace_id=_workspace_id;
  if content_uuid is null then raise exception 'Agendamento não encontrado neste workspace.'; end if;
  -- Lock the content first, consistently with future enqueue/content operations.
  perform 1 from public.content where id=content_uuid and workspace_id=_workspace_id for update;
  update public.scheduler_jobs set status='cancelled',last_error='canceled by user',locked_until=null
    where id=_job_id and workspace_id=_workspace_id and status='pending' returning * into result;
  if result.id is null then raise exception 'Somente agendamentos pendentes podem ser cancelados.'; end if;
  update public.content c set status=case
    when exists(select 1 from public.scheduler_jobs j where j.content_id=content_uuid and j.status='succeeded')
      then 'published'::public.content_status else 'draft'::public.content_status end
    where c.id=content_uuid and c.workspace_id=_workspace_id and c.status='scheduled'
      and not exists(select 1 from public.scheduler_jobs j
        where j.content_id=content_uuid and j.status in ('pending','processing'));
  insert into public.domain_events(workspace_id,event_type,payload) values
    (_workspace_id,'content.publication_cancelled',jsonb_build_object('job_id',_job_id,'content_id',content_uuid));
  return result;
end $$;
revoke all on function public.cancel_publication(uuid,uuid) from public,anon;
grant execute on function public.cancel_publication(uuid,uuid) to authenticated;
