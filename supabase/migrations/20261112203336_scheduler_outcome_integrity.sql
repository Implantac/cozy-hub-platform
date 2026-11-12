-- Preserve terminal outcomes and never requeue a known upstream publication.
create or replace function public.complete_scheduler_job(_job_id uuid,_external_post_id text)
returns public.scheduler_jobs language plpgsql security definer set search_path=public as $$
declare result public.scheduler_jobs; content_uuid uuid;
begin
  if nullif(btrim(_external_post_id),'') is null then
    raise exception using errcode='23514',message='A provider-confirmed external post ID is required';
  end if;
  select content_id into content_uuid from public.scheduler_jobs where id=_job_id;
  if content_uuid is null then raise exception 'Publication job not found'; end if;
  perform 1 from public.content where id=content_uuid for update;
  select * into result from public.scheduler_jobs where id=_job_id for update;
  if result.status='succeeded' and result.external_post_id=_external_post_id then return result; end if;
  if result.status<>'processing' then raise exception 'Only a processing job can be completed'; end if;
  update public.scheduler_jobs set status='succeeded',external_post_id=_external_post_id,last_error=null,locked_until=null
    where id=_job_id returning * into result;
  update public.content set status=case when exists(select 1 from public.scheduler_jobs where content_id=content_uuid and status in ('pending','processing'))
    then 'scheduled'::public.content_status else 'published'::public.content_status end where id=content_uuid;
  insert into public.domain_events(workspace_id,event_type,payload) values(result.workspace_id,'content.published',
    jsonb_build_object('job_id',result.id,'content_id',result.content_id,'channel_id',result.channel_id,'external_post_id',_external_post_id));
  return result;
end $$;
revoke all on function public.complete_scheduler_job(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_scheduler_job(uuid,text) to service_role;

-- A single defaulted signature keeps older server callers compatible (two named arguments).
drop function public.fail_scheduler_job(uuid,text);
create function public.fail_scheduler_job(_job_id uuid,_error text,_retryable boolean default true,_external_post_id text default null)
returns public.scheduler_jobs language plpgsql security definer set search_path=public as $$
declare result public.scheduler_jobs;content_uuid uuid;retry boolean;
begin
  select content_id into content_uuid from public.scheduler_jobs where id=_job_id;
  if content_uuid is null then raise exception 'Publication job not found'; end if;
  perform 1 from public.content where id=content_uuid for update;
  select * into result from public.scheduler_jobs where id=_job_id for update;
  -- A lost HTTP acknowledgement must not undo a committed success or terminal failure.
  if result.status in ('succeeded','dead_letter') then return result; end if;
  if result.status<>'processing' then raise exception 'Only a processing job can fail'; end if;
  retry:=coalesce(_retryable,false) and result.attempts<result.max_attempts and
    nullif(btrim(_external_post_id),'') is null and result.external_post_id is null;
  update public.scheduler_jobs set status=case when retry then 'pending'::public.job_status else 'dead_letter'::public.job_status end,
    last_error=left(_error,1000),locked_until=null,external_post_id=coalesce(nullif(btrim(_external_post_id),''),external_post_id),
    scheduled_at=case when retry then now()+(power(2,least(attempts,10))*interval '30 seconds') else scheduled_at end
    where id=_job_id returning * into result;
  update public.content set status=case
    when exists(select 1 from public.scheduler_jobs where content_id=content_uuid and status in ('pending','processing')) then 'scheduled'::public.content_status
    when exists(select 1 from public.scheduler_jobs where content_id=content_uuid and status='succeeded') then 'published'::public.content_status
    else 'failed'::public.content_status end where id=content_uuid;
  insert into public.domain_events(workspace_id,event_type,payload) values(result.workspace_id,
    case when retry then 'content.publish_retry' else 'content.publish_dead_letter' end,
    jsonb_build_object('job_id',result.id,'error',left(_error,1000),'attempts',result.attempts,'external_post_id',result.external_post_id));
  return result;
end $$;
revoke all on function public.fail_scheduler_job(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.fail_scheduler_job(uuid,text,boolean,text) to service_role;
