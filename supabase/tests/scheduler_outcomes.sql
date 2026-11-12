-- SQL-only outcome contract; no dispatcher or provider call. Everything rolls back.
begin;
set local statement_timeout='45s';
create temporary table qa_o as select gen_random_uuid() owner_id,gen_random_uuid() ws,gen_random_uuid() content_id,
  gen_random_uuid() channel_a,gen_random_uuid() channel_b,gen_random_uuid() job_a,gen_random_uuid() job_b;
create temporary table qa_r(name text,passed boolean,expected text,actual text,affected bigint);
grant select on qa_o to service_role,authenticated,anon;
grant insert,select on qa_r to service_role,authenticated,anon;
insert into auth.users(id,email,raw_user_meta_data) select owner_id,'qa-r3-outcome-'||owner_id||'@example.invalid','{}'::jsonb from qa_o;
insert into public.workspaces(id,owner_id,slug,name) select ws,owner_id,'qa-r3-'||ws,'QA R3 outcomes' from qa_o;
insert into public.content(id,workspace_id,title,status) select content_id,ws,'QA outcome','scheduled' from qa_o;
insert into public.channels(id,workspace_id,platform) select channel_a,ws,'facebook'::public.social_platform from qa_o union all select channel_b,ws,'linkedin'::public.social_platform from qa_o;
insert into public.scheduler_jobs(id,workspace_id,content_id,channel_id,scheduled_at,status,attempts,max_attempts)
  select job_a,ws,content_id,channel_a,now()+interval '30 days','processing'::public.job_status,1,3 from qa_o union all
  select job_b,ws,content_id,channel_b,now()+interval '30 days','processing'::public.job_status,1,3 from qa_o;
create function pg_temp.probe(_name text,_sql text,_expected text default '00000',_rows bigint default 1) returns void language plpgsql as $$
declare state text:='00000';n bigint:=0;
begin begin execute _sql;get diagnostics n=row_count;raise exception using errcode='ZQ001',message='rollback';
exception when sqlstate 'ZQ001' then null;when others then state:=sqlstate;n:=0;end;
insert into qa_r values(_name,state=_expected and (state<>'00000' or n=_rows),_expected,state,n);end $$;
create function pg_temp.ok(value boolean) returns boolean language plpgsql as $$ begin if value is distinct from true then raise exception 'assertion failed';end if;return true;end $$;
create function pg_temp.complete_all() returns boolean language plpgsql as $$
declare f record;r public.scheduler_jobs;
begin select * into f from qa_o;r:=public.complete_scheduler_job(f.job_a,'QA_PROVIDER_ID_A_NOT_SENT');
perform pg_temp.ok((select status='scheduled' from public.content where id=f.content_id));
r:=public.complete_scheduler_job(f.job_b,'QA_PROVIDER_ID_B_NOT_SENT');
perform pg_temp.ok((select status='published' from public.content where id=f.content_id));
r:=public.complete_scheduler_job(f.job_a,'QA_PROVIDER_ID_A_NOT_SENT');
perform pg_temp.ok((select count(*)=2 from public.domain_events where workspace_id=f.ws and event_type='content.published'));
r:=public.fail_scheduler_job(f.job_a,'lost acknowledgement',true,null);
perform pg_temp.ok(r.status='succeeded' and r.external_post_id='QA_PROVIDER_ID_A_NOT_SENT');return true;end $$;
create function pg_temp.fail_all() returns boolean language plpgsql as $$
declare f record;r public.scheduler_jobs;
begin select * into f from qa_o;r:=public.fail_scheduler_job(f.job_a,'invalid credentials',false,null);
perform pg_temp.ok(r.status='dead_letter' and (select status='scheduled' from public.content where id=f.content_id));
r:=public.fail_scheduler_job(f.job_b,'invalid credentials',false,null);
perform pg_temp.ok(r.status='dead_letter' and (select status='failed' from public.content where id=f.content_id));return true;end $$;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.probe('all_channels_completion_and_idempotence','select pg_temp.complete_all()');
select pg_temp.probe('all_channels_terminal_failure_updates_content','select pg_temp.fail_all()');
select pg_temp.probe('completion_requires_nonempty_external_id','select public.complete_scheduler_job(job_a,'''') from qa_o','23514');
select pg_temp.probe('completion_missing_job_rejected','select public.complete_scheduler_job(gen_random_uuid(),''QA_NOT_SENT'')','P0001');
select pg_temp.probe('retryable_failure_can_requeue','select pg_temp.ok((public.fail_scheduler_job(job_a,''rate limited'',true,null)).status=''pending'') from qa_o');
select pg_temp.probe('permanent_failure_not_requeued','select pg_temp.ok((public.fail_scheduler_job(job_a,''invalid'',false,null)).status=''dead_letter'') from qa_o');
select pg_temp.probe('known_upstream_id_never_requeued','select pg_temp.ok((public.fail_scheduler_job(job_a,''lost ack'',true,''QA_UPSTREAM_ID_NOT_SENT'')).status=''dead_letter'') from qa_o');
select pg_temp.probe('known_upstream_id_retained','select pg_temp.ok((public.fail_scheduler_job(job_a,''lost ack'',false,''QA_UPSTREAM_ID_NOT_SENT'')).external_post_id=''QA_UPSTREAM_ID_NOT_SENT'') from qa_o');
select pg_temp.probe('missing_failure_job_rejected','select public.fail_scheduler_job(gen_random_uuid(),''unknown'',true,null)','P0001');
reset role;
-- These helpers change only their own rolled-back probe's fixture.
create function pg_temp.pending_completion() returns boolean language plpgsql as $$ begin update public.scheduler_jobs set status='pending' where id=(select job_a from qa_o);perform public.complete_scheduler_job((select job_a from qa_o),'QA_NOT_SENT');return true;end $$;
create function pg_temp.exhausted_failure() returns boolean language plpgsql as $$ begin update public.scheduler_jobs set attempts=max_attempts where id=(select job_a from qa_o);return pg_temp.ok((public.fail_scheduler_job((select job_a from qa_o),'exhausted',true,null)).status='dead_letter');end $$;
select pg_temp.probe('unclaimed_completion_rejected','select pg_temp.pending_completion()','P0001');
select pg_temp.probe('exhausted_failure_not_requeued','select pg_temp.exhausted_failure()');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from qa_o),'role','authenticated')::text,true);
select pg_temp.probe('client_completion_rejected','select public.complete_scheduler_job(job_a,''QA_NOT_SENT'') from qa_o','42501');
select pg_temp.probe('client_failure_rejected','select public.fail_scheduler_job(job_a,''fake'',false,null) from qa_o','42501');
reset role;
select jsonb_build_object('all_passed',bool_and(passed),'passed',count(*) filter(where passed),'failed',count(*) filter(where not passed),'total',count(*),'results',jsonb_agg(to_jsonb(r) order by name)) as result from qa_r r;
rollback;
