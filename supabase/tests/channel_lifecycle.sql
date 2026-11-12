-- No provider call. Isolated SQL fixtures and complete rollback.
begin;
set local statement_timeout='30s';
create temporary table qa_g as select gen_random_uuid() owner_id,gen_random_uuid() editor_id,gen_random_uuid() ws,
  gen_random_uuid() content_id,gen_random_uuid() busy,gen_random_uuid() idle,gen_random_uuid() job_id;
create temporary table qa_r(name text,passed boolean,expected text,actual text,affected bigint);
grant select on qa_g to authenticated,service_role;
grant insert,select on qa_r to authenticated,service_role;
insert into auth.users(id,email,raw_user_meta_data) select u,'qa-r3-channel-'||u||'@example.invalid','{}'::jsonb from qa_g cross join lateral unnest(array[owner_id,editor_id]) u;
insert into public.workspaces(id,owner_id,name,slug) select ws,owner_id,'QA R3 channel guard','qa-r3-'||ws from qa_g;
insert into public.workspace_members(workspace_id,user_id,role) select ws,editor_id,'editor' from qa_g;
insert into public.content(id,workspace_id,title,status) select content_id,ws,'QA R3 guarded channel','scheduled' from qa_g;
insert into public.channels(id,workspace_id,platform) select busy,ws,'facebook'::public.social_platform from qa_g union all select idle,ws,'linkedin'::public.social_platform from qa_g;
insert into public.scheduler_jobs(id,workspace_id,content_id,channel_id,scheduled_at) select job_id,ws,content_id,busy,now()+interval '30 days' from qa_g;
create function pg_temp.probe(_name text,_sql text,_expected text default '00000',_rows bigint default 1) returns void language plpgsql as $$
declare state text:='00000';n bigint:=0;
begin begin execute _sql;get diagnostics n=row_count;raise exception using errcode='ZQ001',message='rollback';
exception when sqlstate 'ZQ001' then null;when others then state:=sqlstate;n:=0;end;
insert into qa_r values(_name,state=_expected and (state<>'00000' or n=_rows),_expected,state,n);end $$;
create function pg_temp.cancel_delete() returns boolean language plpgsql as $$
begin
  perform public.cancel_publication((select ws from qa_g),(select job_id from qa_g));
  delete from public.channels where id=(select busy from qa_g);
  if exists(select 1 from public.scheduler_jobs where id=(select job_id from qa_g)) or
    not (select status='draft' from public.content where id=(select content_id from qa_g)) then raise exception 'cancellation/deletion inconsistent';end if;
  return true;
end $$;
create function pg_temp.processing_delete() returns boolean language plpgsql as $$
begin update public.scheduler_jobs set status='processing' where id=(select job_id from qa_g);
  delete from public.channels where id=(select busy from qa_g);return true;end $$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from qa_g),'role','authenticated')::text,true);
select pg_temp.probe('owner_active_channel_delete_blocked','delete from public.channels where id=(select busy from qa_g)','23514');
select pg_temp.probe('owner_idle_channel_delete_allowed','delete from public.channels where id=(select idle from qa_g)');
select pg_temp.probe('cancel_then_delete_keeps_content_consistent','select pg_temp.cancel_delete()');
select pg_temp.probe('owner_parent_workspace_cascade_allowed','delete from public.workspaces where id=(select ws from qa_g)');
select pg_temp.probe('client_guard_function_not_executable','select public.guard_channel_publications()','42501');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select editor_id from qa_g),'role','authenticated')::text,true);
select pg_temp.probe('editor_cannot_delete_idle_channel','delete from public.channels where id=(select idle from qa_g)','00000',0);
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.probe('processing_channel_delete_blocked','select pg_temp.processing_delete()','23514');
reset role;
select jsonb_build_object('all_passed',bool_and(passed),'passed',count(*) filter(where passed),'failed',count(*) filter(where not passed),'total',count(*),'results',jsonb_agg(to_jsonb(r) order by name)) as result from qa_r r;
rollback;
