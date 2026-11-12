-- Run only with an administrative SQL connection to the VELT database.
-- No real user/workspace ID is used. All fixtures and all attempted writes roll back.
-- Acceptance: result.all_passed = true and result.failed = 0 (not merely HTTP 200).
begin;
set local statement_timeout = '45s';
create temporary table qa_ids as select
  gen_random_uuid() owner_a,gen_random_uuid() owner_b,gen_random_uuid() admin_a,
  gen_random_uuid() editor_a,gen_random_uuid() viewer_a,gen_random_uuid() spare,
  gen_random_uuid() ws_a,gen_random_uuid() ws_b,gen_random_uuid() brand_a,gen_random_uuid() brand_b,
  gen_random_uuid() content_a,gen_random_uuid() content_b,gen_random_uuid() content_due,
  gen_random_uuid() channel_a,gen_random_uuid() channel_a2,gen_random_uuid() channel_b,
  gen_random_uuid() page_a,gen_random_uuid() page_b,gen_random_uuid() link_a,gen_random_uuid() link_a2,
  gen_random_uuid() link_b,gen_random_uuid() job_a,gen_random_uuid() job_due,gen_random_uuid() job_b,
  gen_random_uuid() job_failed,gen_random_uuid() content_ready;
create temporary table qa_results(test text,passed boolean,expected_state text,actual_state text,affected bigint,detail text);
grant select on qa_ids to authenticated,anon,service_role;
grant insert,select on qa_results to authenticated,anon,service_role;
insert into auth.users(id,email,raw_user_meta_data)
select u,'qa-r3-rbac-'||u::text||'@example.invalid','{"full_name":"QA R3 transaction only"}'::jsonb
from qa_ids cross join lateral unnest(array[owner_a,owner_b,admin_a,editor_a,viewer_a,spare]) u;
insert into public.workspaces(id,owner_id,slug,name)
select ws_a,owner_a,'qa-r3-'||ws_a::text,'QA R3 A transaction only' from qa_ids
union all select ws_b,owner_b,'qa-r3-'||ws_b::text,'QA R3 B transaction only' from qa_ids;
insert into public.workspace_members(workspace_id,user_id,role)
select ws_a,admin_a,'admin'::public.app_role from qa_ids
union all select ws_a,editor_a,'editor'::public.app_role from qa_ids
union all select ws_a,viewer_a,'viewer'::public.app_role from qa_ids;
insert into public.brands(id,workspace_id,name)
select brand_a,ws_a,'QA Brand A' from qa_ids union all select brand_b,ws_b,'QA Brand B' from qa_ids;
insert into public.content(id,workspace_id,title,status)
select content_a,ws_a,'QA A','scheduled'::public.content_status from qa_ids
union all select content_b,ws_b,'QA B','draft'::public.content_status from qa_ids
union all select content_due,ws_a,'QA due (never sent)','draft'::public.content_status from qa_ids
union all select content_ready,ws_a,'QA ready (never sent)','draft'::public.content_status from qa_ids;
insert into public.channels(id,workspace_id,platform,status,handle)
select channel_a,ws_a,'instagram'::public.social_platform,'disconnected'::public.channel_status,'qa_not_connected_a' from qa_ids
union all select channel_a2,ws_a,'facebook'::public.social_platform,'disconnected'::public.channel_status,'qa_not_connected_a2' from qa_ids
union all select channel_b,ws_b,'instagram'::public.social_platform,'disconnected'::public.channel_status,'qa_not_connected_b' from qa_ids;
insert into public.scheduler_jobs(id,workspace_id,content_id,channel_id,scheduled_at,status)
select job_a,ws_a,content_a,channel_a,now()+interval '30 days','pending'::public.job_status from qa_ids
union all select job_due,ws_a,content_due,channel_a,now()-interval '1 minute','pending'::public.job_status from qa_ids
union all select job_b,ws_b,content_b,channel_b,now()-interval '1 minute','pending'::public.job_status from qa_ids
union all select job_failed,ws_a,content_due,channel_a,now()+interval '30 days','failed'::public.job_status from qa_ids;
insert into public.bio_pages(id,workspace_id,slug,headline,is_published)
select page_a,ws_a,'qar3-'||left(replace(page_a::text,'-',''),20),'QA private A',false from qa_ids
union all select page_b,ws_b,'qar3-'||left(replace(page_b::text,'-',''),20),'QA private B',false from qa_ids;
insert into public.bio_links(id,page_id,label,url,position)
select link_a,page_a,'QA Link A','https://example.invalid/a',0 from qa_ids
union all select link_a2,page_a,'QA Link A2','https://example.invalid/a2',1 from qa_ids
union all select link_b,page_b,'QA Link B','https://example.invalid/b',0 from qa_ids;

-- Every individual probe runs in a subtransaction which is always rolled back.
create function pg_temp.check_sql(_name text,_sql text,_state text default '00000',_rows bigint default null)
returns void language plpgsql security invoker as $$
declare n bigint:=0; actual text:='00000'; detail text:='operation reverted';
begin
  begin
    execute _sql;
    get diagnostics n=row_count;
    raise exception using errcode='ZQ001',message='qa_probe_rollback';
  exception when sqlstate 'ZQ001' then null;
    when others then actual:=sqlstate;detail:=sqlerrm;n:=0;
  end;
  insert into qa_results values(_name,actual=_state and (_rows is null or n=_rows),_state,actual,n,detail);
end $$;
create function pg_temp.assert_true(_ok boolean,_message text) returns boolean
language plpgsql security invoker as $$ begin
  if _ok is distinct from true then raise exception using errcode='ZQ002',message=_message; end if;
  return true;
end $$;
create function pg_temp.verify_reorder() returns boolean language plpgsql security invoker as $$
declare f record; n integer; unchanged boolean;
begin
  select * into f from qa_ids;
  begin
    perform public.reorder_bio_links(f.ws_a,array[f.link_a2,f.link_b]);
    raise exception using errcode='ZQ002',message='foreign reorder unexpectedly succeeded';
  exception when sqlstate 'P0001' then null; end;
  select bool_and((id=f.link_a and position=0) or (id=f.link_a2 and position=1)) into unchanged
    from public.bio_links where page_id=f.page_a;
  perform pg_temp.assert_true(unchanged,'invalid reorder partially changed positions');
  n:=public.reorder_bio_links(f.ws_a,array[f.link_a2,f.link_a]);
  perform pg_temp.assert_true(n=2 and exists(select 1 from public.bio_links where id=f.link_a2 and position=0)
    and exists(select 1 from public.bio_links where id=f.link_a and position=1),'valid reorder was not fully persisted');
  return true;
end $$;
create function pg_temp.verify_append() returns boolean language plpgsql security invoker as $$
declare f record; l public.bio_links;
begin
  select * into f from qa_ids;
  l:=public.add_bio_link(f.ws_a,'QA Email','mailto:qa@example.invalid','email');
  perform pg_temp.assert_true(l.position=2 and l.page_id=f.page_a,'append used wrong parent/position');
  l:=public.add_bio_link(f.ws_a,'QA Phone','tel:+5543999990000','phone');
  perform pg_temp.assert_true(l.position=3,'append did not advance position');
  return true;
end $$;
create function pg_temp.verify_cancel() returns boolean language plpgsql security invoker as $$
declare f record; j public.scheduler_jobs;
begin
  select * into f from qa_ids;
  j:=public.cancel_publication(f.ws_a,f.job_a);
  perform pg_temp.assert_true(j.status='cancelled' and j.external_post_id is null,'cancellation was not confirmed');
  perform pg_temp.assert_true((select status='draft' from public.content where id=f.content_a),'last pending cancellation did not restore draft');
  perform pg_temp.assert_true(exists(select 1 from public.domain_events where workspace_id=f.ws_a
    and event_type='content.publication_cancelled' and payload->>'job_id'=f.job_a::text),'cancellation event was not persisted');
  begin
    perform public.cancel_publication(f.ws_a,f.job_a);
    raise exception using errcode='ZQ002',message='second cancellation unexpectedly succeeded';
  exception when sqlstate 'P0001' then null; end;
  return true;
end $$;
create function pg_temp.verify_cancel_multiple() returns boolean language plpgsql security invoker as $$
declare f record; second_job_id uuid;
begin
  select * into f from qa_ids;
  -- Administrative fixture preparation only; no publisher/dispatcher is called.
  insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at)
    values(f.ws_a,f.content_a,f.channel_a2,now()+interval '31 days') returning id into second_job_id;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.admin_a,'role','authenticated')::text,true);
  perform public.cancel_publication(f.ws_a,f.job_a);
  perform pg_temp.assert_true((select status='scheduled' from public.content where id=f.content_a),'canceling one channel erased another pending publication');
  perform public.cancel_publication(f.ws_a,second_job_id);
  perform pg_temp.assert_true((select status='draft' from public.content where id=f.content_a),'last cancellation did not restore draft');
  return true;
end $$;
create function pg_temp.verify_enqueue() returns boolean language plpgsql security invoker as $$
declare f record; n integer;
begin
  select * into f from qa_ids;
  -- Clearly synthetic token ciphertext, unreadable and never used: transaction is rolled back.
  update public.channels set status='connected' where id in(f.channel_a,f.channel_a2);
  insert into public.oauth_tokens(channel_id,access_token_ciphertext) values
    (f.channel_a,'QA_INVALID_UNUSED_NEVER_SENT'),(f.channel_a2,'QA_INVALID_UNUSED_NEVER_SENT');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.editor_a,'role','authenticated')::text,true);
  select count(*) into n from public.enqueue_publication(f.content_ready,array[f.channel_a,f.channel_a2],now()+interval '30 days');
  perform pg_temp.assert_true(n=2,'enqueue did not persist both channel jobs');
  perform pg_temp.assert_true((select status='scheduled' from public.content where id=f.content_ready),'enqueue did not mark content scheduled');
  begin
    perform public.enqueue_publication(f.content_ready,array[f.channel_a],now()+interval '30 days');
    raise exception using errcode='ZQ002',message='duplicate enqueue unexpectedly succeeded';
  exception when sqlstate 'P0001' then null; end;
  perform pg_temp.assert_true((select count(*)=2 from public.scheduler_jobs where content_id=f.content_ready),'duplicate enqueue changed jobs');
  return true;
end $$;
create function pg_temp.verify_scoped_claim() returns boolean language plpgsql security invoker as $$
declare f record; total integer; claimed_id uuid;
begin
  select * into f from qa_ids;
  select count(*),min(id::text)::uuid into total,claimed_id from public.claim_workspace_scheduler_jobs(f.ws_a,10,60);
  perform pg_temp.assert_true(total=1 and claimed_id=f.job_due,'scoped claim selected wrong jobs');
  perform pg_temp.assert_true((select status='pending' from public.scheduler_jobs where id=f.job_b),'scoped claim touched another workspace');
  perform pg_temp.assert_true((select status='pending' from public.scheduler_jobs where id=f.job_a),'scoped claim selected a future job');
  return true;
end $$;

select pg_temp.check_sql('bootstrap_primary_owner','select pg_temp.assert_true((select count(*)=2 from public.workspace_members m join qa_ids f on m.workspace_id in (f.ws_a,f.ws_b) where m.role=''owner''),''owner bootstrap missing'')','00000',1);
select pg_temp.check_sql('privileged_owner_membership_guard','delete from public.workspace_members where workspace_id=(select ws_a from qa_ids) and user_id=(select owner_a from qa_ids)','23514');
select pg_temp.check_sql('cross_job_channel_fk','insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at) select ws_a,content_a,channel_b,now()+interval ''30 days'' from qa_ids','23503');
select pg_temp.check_sql('enqueue_atomic_and_no_duplicate','select pg_temp.verify_enqueue()','00000',1);
select pg_temp.check_sql('cancel_keeps_other_pending_channel','select pg_temp.verify_cancel_multiple()','00000',1);
select pg_temp.check_sql('cross_job_content_fk','insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at) select ws_a,content_b,channel_a,now()+interval ''30 days'' from qa_ids','23503');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select viewer_a from qa_ids),'role','authenticated')::text,true);
select pg_temp.check_sql('viewer_read_private_bio','select id from public.bio_pages where id=(select page_a from qa_ids)','00000',1);
select pg_temp.check_sql('viewer_delete_bio_link','delete from public.bio_links where id=(select link_a from qa_ids)','00000',0);
select pg_temp.check_sql('viewer_delete_bio_page','delete from public.bio_pages where id=(select page_a from qa_ids)','00000',0);
select pg_temp.check_sql('viewer_update_bio','update public.bio_pages set headline=''forbidden'' where id=(select page_a from qa_ids)','00000',0);
select pg_temp.check_sql('viewer_update_content','update public.content set title=''forbidden'' where id=(select content_a from qa_ids)','00000',0);
select pg_temp.check_sql('viewer_insert_content','insert into public.content(workspace_id,title) select ws_a,''forbidden'' from qa_ids','42501');
select pg_temp.check_sql('viewer_reorder_rpc','select public.reorder_bio_links(ws_a,array[link_a2,link_a]) from qa_ids','42501');
select pg_temp.check_sql('viewer_append_rpc','select public.add_bio_link(ws_a,''QA'',''https://example.invalid'',''link'') from qa_ids','42501');
select pg_temp.check_sql('viewer_cancel_rpc','select public.cancel_publication(ws_a,job_a) from qa_ids','42501');
select pg_temp.check_sql('viewer_enqueue_rpc','select public.enqueue_publication(content_a,array[channel_a],now()+interval ''30 days'') from qa_ids','42501');
select pg_temp.check_sql('private_slug_availability','select pg_temp.assert_true(not public.bio_slug_available((select slug from public.bio_pages where id=(select page_a from qa_ids))),''owned slug falsely available'')','00000',1);

select set_config('request.jwt.claims',jsonb_build_object('sub',(select admin_a from qa_ids),'role','authenticated')::text,true);
select pg_temp.check_sql('admin_insert_additional_owner','insert into public.workspace_members(workspace_id,user_id,role) select ws_a,spare,''owner'' from qa_ids','23514');
select pg_temp.check_sql('admin_demote_primary_owner','update public.workspace_members set role=''viewer'' where workspace_id=(select ws_a from qa_ids) and user_id=(select owner_a from qa_ids)','00000',0);
select pg_temp.check_sql('admin_delete_primary_owner','delete from public.workspace_members where workspace_id=(select ws_a from qa_ids) and user_id=(select owner_a from qa_ids)','00000',0);
select pg_temp.check_sql('admin_reassign_workspace_owner','update public.workspaces set owner_id=(select admin_a from qa_ids) where id=(select ws_a from qa_ids)','23514');
select pg_temp.check_sql('admin_self_role_update','update public.workspace_members set role=''owner'' where workspace_id=(select ws_a from qa_ids) and user_id=(select admin_a from qa_ids)','00000',0);
select pg_temp.check_sql('admin_update_regular_member','update public.workspace_members set role=''viewer'' where workspace_id=(select ws_a from qa_ids) and user_id=(select editor_a from qa_ids)','00000',1);
select pg_temp.check_sql('admin_add_regular_member','insert into public.workspace_members(workspace_id,user_id,role) select ws_a,spare,''editor'' from qa_ids','00000',1);
select pg_temp.check_sql('admin_update_workspace_name','update public.workspaces set name=''QA renamed'' where id=(select ws_a from qa_ids)','00000',1);
select pg_temp.check_sql('cross_workspace_brand_content','insert into public.content(workspace_id,brand_id,title) select ws_a,brand_b,''invalid'' from qa_ids','23503');
select pg_temp.check_sql('cross_workspace_brand_channel','insert into public.channels(workspace_id,brand_id,platform) select ws_a,brand_b,''instagram'' from qa_ids','23503');
select pg_temp.check_sql('valid_content_brand','insert into public.content(workspace_id,brand_id,title) select ws_a,brand_a,''valid'' from qa_ids','00000',1);
select pg_temp.check_sql('valid_channel_brand','insert into public.channels(workspace_id,brand_id,platform) select ws_a,brand_a,''instagram'' from qa_ids','00000',1);
select pg_temp.check_sql('direct_insert_publication_blocked','insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at,status) select ws_a,content_a,channel_a,now()+interval ''30 days'',''succeeded'' from qa_ids','42501');
select pg_temp.check_sql('direct_forge_success_blocked','update public.scheduler_jobs set status=''succeeded'',external_post_id=''qa_not_sent'' where id=(select job_a from qa_ids)','00000',0);
select pg_temp.check_sql('authenticated_claim_rpc_blocked','select public.claim_workspace_scheduler_jobs(ws_a,10,60) from qa_ids','42501');
select pg_temp.check_sql('foreign_content_read','select id from public.content where id=(select content_b from qa_ids)','00000',0);
select pg_temp.check_sql('foreign_bio_read','select id from public.bio_pages where id=(select page_b from qa_ids)','00000',0);
select pg_temp.check_sql('foreign_cancel_rpc','select public.cancel_publication(ws_a,job_b) from qa_ids','P0001');
select pg_temp.check_sql('enqueue_disconnected_rejected','select public.enqueue_publication(content_ready,array[channel_a],now()+interval ''30 days'') from qa_ids','P0001');
select pg_temp.check_sql('enqueue_empty_channels_rejected','select public.enqueue_publication(content_ready,array[]::uuid[],now()+interval ''30 days'') from qa_ids','P0001');
select pg_temp.check_sql('enqueue_duplicate_channels_rejected','select public.enqueue_publication(content_ready,array[channel_a,channel_a],now()+interval ''30 days'') from qa_ids','P0001');
select pg_temp.check_sql('enqueue_past_time_rejected','select public.enqueue_publication(content_ready,array[channel_a],now()-interval ''1 day'') from qa_ids','P0001');
select pg_temp.check_sql('nonpending_cancel_rpc','select public.cancel_publication(ws_a,job_failed) from qa_ids','P0001');
select pg_temp.check_sql('bio_email_save','insert into public.bio_links(page_id,label,kind,url) select page_a,''Email'',''email'',''mailto:qa@example.invalid'' from qa_ids','00000',1);
select pg_temp.check_sql('bio_phone_save','insert into public.bio_links(page_id,label,kind,url) select page_a,''Phone'',''phone'',''tel:+5543999990000'' from qa_ids','00000',1);
select pg_temp.check_sql('bio_javascript_rejected','insert into public.bio_links(page_id,label,kind,url) select page_a,''Bad'',''link'',''javascript:alert(1)'' from qa_ids','23514');
select pg_temp.check_sql('bio_mail_header_rejected','insert into public.bio_links(page_id,label,kind,url) select page_a,''Bad'',''email'',''mailto:qa@example.invalid?bcc=other@example.invalid'' from qa_ids','23514');
select pg_temp.check_sql('bio_mismatched_kind_rejected','insert into public.bio_links(page_id,label,kind,url) select page_a,''Bad'',''phone'',''https://example.invalid'' from qa_ids','23514');
select pg_temp.check_sql('bio_full_atomic_order','select pg_temp.verify_reorder()','00000',1);
select pg_temp.check_sql('bio_atomic_append','select pg_temp.verify_append()','00000',1);
select pg_temp.check_sql('bio_duplicate_order_rejected','select public.reorder_bio_links(ws_a,array[link_a,link_a]) from qa_ids','P0001');
select pg_temp.check_sql('bio_incomplete_order_rejected','select public.reorder_bio_links(ws_a,array[link_a]) from qa_ids','P0001');
select pg_temp.check_sql('bio_foreign_order_rejected','select public.reorder_bio_links(ws_a,array[link_a,link_b]) from qa_ids','P0001');
select pg_temp.check_sql('cancel_restores_content_and_event','select pg_temp.verify_cancel()','00000',1);

select set_config('request.jwt.claims',jsonb_build_object('sub',(select editor_a from qa_ids),'role','authenticated')::text,true);
select pg_temp.check_sql('editor_edit_bio_link','update public.bio_links set label=''QA edited'' where id=(select link_a from qa_ids)','00000',1);
select pg_temp.check_sql('editor_delete_bio_link','delete from public.bio_links where id=(select link_a from qa_ids)','00000',1);
select pg_temp.check_sql('editor_delete_brand_blocked','delete from public.brands where id=(select brand_a from qa_ids)','00000',0);
select pg_temp.check_sql('editor_manage_channel_blocked','update public.channels set handle=''forbidden'' where id=(select channel_a from qa_ids)','00000',0);
select pg_temp.check_sql('editor_self_leave','delete from public.workspace_members where workspace_id=(select ws_a from qa_ids) and user_id=(select editor_a from qa_ids)','00000',1);
select pg_temp.check_sql('editor_cancel_rpc','select pg_temp.verify_cancel()','00000',1);
select pg_temp.check_sql('editor_reorder_rpc','select pg_temp.verify_reorder()','00000',1);

select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_a from qa_ids),'role','authenticated')::text,true);
select pg_temp.check_sql('primary_owner_self_leave_blocked','delete from public.workspace_members where workspace_id=(select ws_a from qa_ids) and user_id=(select owner_a from qa_ids)','00000',0);
select pg_temp.check_sql('owner_delete_workspace_cascade','delete from public.workspaces where id=(select ws_a from qa_ids)','00000',1);

set local role service_role;
select pg_temp.check_sql('service_claim_is_scoped_and_due_only','select pg_temp.verify_scoped_claim()','00000',1);
set local role anon;
select pg_temp.check_sql('anon_private_bio_read_blocked','select id from public.bio_pages where id=(select page_a from qa_ids)','42501');
select pg_temp.check_sql('anon_reorder_rpc_blocked','select public.reorder_bio_links(ws_a,array[link_a2,link_a]) from qa_ids','42501');
reset role;
select jsonb_build_object('all_passed',bool_and(passed),'passed',count(*) filter(where passed),
  'failed',count(*) filter(where not passed),'total',count(*),
  'method','synthetic fixtures, real database roles, individual subtransaction rollback, full transaction rollback',
  'results',jsonb_agg(to_jsonb(r) order by test)) as result from qa_results r;
rollback;
