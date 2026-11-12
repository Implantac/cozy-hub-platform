-- VELT only. Synthetic SQL fixtures, no passwords/tokens usable at a provider.
-- Individual subtransactions and the complete transaction are rolled back.
begin;
set local statement_timeout='45s';
create temporary table qa_d as select gen_random_uuid() ws,gen_random_uuid() ws_b,
  gen_random_uuid() owner_id,gen_random_uuid() other_owner,gen_random_uuid() editor_id,
  gen_random_uuid() draft,gen_random_uuid() active,gen_random_uuid() channel_a,
  gen_random_uuid() channel_b,gen_random_uuid() brand_b,gen_random_uuid() page,gen_random_uuid() link;
create temporary table qa_r(name text,passed boolean,expected text,actual text,affected bigint,detail text);
grant select on qa_d to authenticated,anon,service_role;
grant select,insert on qa_r to authenticated,anon,service_role;
insert into auth.users(id,email,raw_user_meta_data)
  select u,'qa-r3-delivery-'||u||'@example.invalid','{}'::jsonb from qa_d cross join lateral unnest(array[owner_id,other_owner,editor_id]) u;
insert into public.workspaces(id,owner_id,slug,name)
  select ws,owner_id,'qa-r3-'||ws,'QA R3 delivery' from qa_d union all
  select ws_b,other_owner,'qa-r3-'||ws_b,'QA R3 delivery B' from qa_d;
insert into public.workspace_members(workspace_id,user_id,role) select ws,editor_id,'editor' from qa_d;
insert into public.brands(id,workspace_id,name) select brand_b,ws_b,'QA foreign brand' from qa_d;
insert into public.content(id,workspace_id,title,status) select draft,ws,'QA draft','draft'::public.content_status from qa_d union all select active,ws,'QA active','scheduled'::public.content_status from qa_d;
insert into public.channels(id,workspace_id,platform,handle) select channel_a,ws,'facebook'::public.social_platform,'qa_a' from qa_d union all select channel_b,ws_b,'facebook'::public.social_platform,'qa_b' from qa_d;
insert into public.scheduler_jobs(workspace_id,content_id,channel_id,scheduled_at) select ws,active,channel_a,now()+interval '30 days' from qa_d;
insert into public.bio_pages(id,workspace_id,slug) select page,ws,'qa-r3-'||left(replace(page::text,'-',''),20) from qa_d;
insert into public.bio_links(id,page_id,label,url) select link,page,'QA Link','https://example.invalid' from qa_d;
create function pg_temp.probe(_name text,_sql text,_expected text default '00000',_rows bigint default null)
returns void language plpgsql as $$
declare n bigint:=0; state text:='00000'; message text:='operation reverted';
begin
  begin execute _sql;get diagnostics n=row_count;raise exception using errcode='ZQ001',message='rollback probe';
  exception when sqlstate 'ZQ001' then null;when others then state:=sqlstate;message:=sqlerrm;n:=0;end;
  insert into qa_r values(_name,state=_expected and (_rows is null or n=_rows),_expected,state,n,message);
end $$;
create function pg_temp.ok(_value boolean) returns boolean language plpgsql as $$
begin if _value is distinct from true then raise exception 'assertion failed';end if;return true;end $$;
create function pg_temp.oauth(_actor uuid,_brand uuid default null,_external text default 'qa_external',_cipher text default 'QA_INVALID_UNUSED_NEVER_SENT',_metadata jsonb default '{}') returns public.channels language sql as $$
  select public.complete_oauth_connection((select ws from qa_d),_actor,_brand,'facebook',_external,'QA Synthetic',_metadata,_cipher,null,'Bearer',null,null);
$$;
create function pg_temp.verify_oauth() returns boolean language plpgsql as $$
declare ch public.channels;ch2 public.channels;f record;
begin
  select * into f from qa_d;ch:=pg_temp.oauth(f.owner_id);
  perform pg_temp.ok(ch.status='connected' and ch.workspace_id=f.ws);
  perform pg_temp.ok((select count(*)=1 from public.oauth_tokens where channel_id=ch.id and access_token_ciphertext='QA_INVALID_UNUSED_NEVER_SENT'));
  perform pg_temp.ok((select count(*)=1 from public.domain_events where workspace_id=f.ws and event_type='channel.connected' and payload->>'channel_id'=ch.id::text));
  update public.oauth_tokens set refresh_token_ciphertext='QA_REFRESH_INVALID_UNUSED' where channel_id=ch.id;
  ch2:=pg_temp.oauth(f.owner_id);perform pg_temp.ok(ch2.id=ch.id);
  perform pg_temp.ok((select refresh_token_ciphertext='QA_REFRESH_INVALID_UNUSED' from public.oauth_tokens where channel_id=ch.id));
  return true;
end $$;
create function pg_temp.verify_click(_published boolean,_active boolean) returns boolean language plpgsql as $$
declare f record;
begin
  select * into f from qa_d;update public.bio_pages set is_published=_published where id=f.page;
  update public.bio_links set is_active=_active where id=f.link;
  perform public.bio_register_click(f.link,'example.invalid','desktop',null);
  perform pg_temp.ok((select count(*)=case when _published and _active then 1 else 0 end from public.bio_link_clicks where link_id=f.link));
  perform pg_temp.ok((select click_count=case when _published and _active then 1 else 0 end from public.bio_links where id=f.link));
  return true;
end $$;
create function pg_temp.verify_disconnect() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare ch public.channels;f record;
begin
  select * into f from qa_d;ch:=pg_temp.oauth(f.owner_id);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',f.owner_id,'role','authenticated')::text,true);
  ch:=public.disconnect_oauth_channel(ch.id);
  perform pg_temp.ok(ch.status='disconnected' and not exists(select 1 from public.oauth_tokens where channel_id=ch.id));
  perform pg_temp.ok(exists(select 1 from public.domain_events where workspace_id=f.ws and event_type='channel.disconnected' and payload->>'channel_id'=ch.id::text));
  return true;
end $$;
select pg_temp.probe('snapshot_cross_channel_fk','insert into public.analytics_snapshots(workspace_id,channel_id,content_id,metrics) select ws,channel_b,draft,''{"impressions":10}''::jsonb from qa_d','23503');
select pg_temp.probe('snapshot_cross_content_fk','insert into public.analytics_snapshots(workspace_id,channel_id,content_id,metrics) select ws_b,channel_b,draft,''{"impressions":10}''::jsonb from qa_d','23503');
select pg_temp.probe('published_active_click','select pg_temp.verify_click(true,true)','00000',1);
select pg_temp.probe('unpublished_click_not_recorded','select pg_temp.verify_click(false,true)','00000',1);
select pg_temp.probe('inactive_click_not_recorded','select pg_temp.verify_click(true,false)','00000',1);
select pg_temp.probe('oauth_atomic_connection_reconnect','select pg_temp.verify_oauth()','00000',1);
select pg_temp.probe('oauth_disconnect_removes_ciphertext','select pg_temp.verify_disconnect()','00000',1);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select owner_id from qa_d),'role','authenticated')::text,true);
select pg_temp.probe('plan_self_upgrade_blocked','update public.workspaces set plan=''enterprise'' where id=(select ws from qa_d)','42501');
select pg_temp.probe('plan_insert_upgrade_blocked','insert into public.workspaces(owner_id,slug,name,plan) select owner_id,''qa-extra-''||ws,''QA invalid'',''pro'' from qa_d','42501');
select pg_temp.probe('workspace_regular_edit','update public.workspaces set name=''QA allowed rename'' where id=(select ws from qa_d)','00000',1);
select pg_temp.probe('content_new_draft_allowed','insert into public.content(workspace_id,title) select ws,''QA allowed'' from qa_d','00000',1);
select pg_temp.probe('content_new_published_blocked','insert into public.content(workspace_id,title,status) select ws,''QA forged'',''published'' from qa_d','23514');
select pg_temp.probe('content_forge_delivery_blocked','update public.content set status=''published'' where id=(select draft from qa_d)','23514');
select pg_temp.probe('content_draft_edit_allowed','update public.content set body=''QA edited'' where id=(select draft from qa_d)','00000',1);
select pg_temp.probe('content_archive_allowed','update public.content set status=''archived'' where id=(select draft from qa_d)','00000',1);
select pg_temp.probe('active_content_edit_blocked','update public.content set body=''not allowed'' where id=(select active from qa_d)','23514');
select pg_temp.probe('active_content_status_blocked','update public.content set status=''draft'' where id=(select active from qa_d)','23514');
select pg_temp.probe('active_content_delete_blocked','delete from public.content where id=(select active from qa_d)','23514');
select pg_temp.probe('direct_job_delete_blocked','delete from public.scheduler_jobs where workspace_id=(select ws from qa_d)','00000',0);
select pg_temp.probe('client_metric_forgery_blocked','insert into public.analytics_snapshots(workspace_id,channel_id,content_id,metrics) select ws,channel_a,draft,''{"impressions":9999999}''::jsonb from qa_d','42501');
select pg_temp.probe('client_complete_oauth_blocked','select pg_temp.oauth(owner_id) from qa_d','42501');
select pg_temp.probe('owner_workspace_cascade_allowed','delete from public.workspaces where id=(select ws from qa_d)','00000',1);
select set_config('request.jwt.claims',jsonb_build_object('sub',(select editor_id from qa_d),'role','authenticated')::text,true);
select pg_temp.probe('editor_draft_edit_allowed','update public.content set body=''QA editor'' where id=(select draft from qa_d)','00000',1);
select pg_temp.probe('editor_disconnect_blocked','select public.disconnect_oauth_channel(channel_a) from qa_d','42501');
reset role;
select pg_temp.probe('oauth_revoked_actor_blocked','select pg_temp.oauth(editor_id) from qa_d','42501');
select pg_temp.probe('oauth_foreign_brand_blocked','select pg_temp.oauth(owner_id,brand_b) from qa_d','23503');
select pg_temp.probe('oauth_missing_external_identity','select pg_temp.oauth(owner_id,null,'''') from qa_d','23514');
select pg_temp.probe('oauth_missing_ciphertext','select pg_temp.oauth(owner_id,null,''qa_external'','''') from qa_d','23514');
select pg_temp.probe('oauth_invalid_metadata','select pg_temp.oauth(owner_id,null,''qa_external'',''QA_INVALID_UNUSED_NEVER_SENT'',''[]'') from qa_d','23514');
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select pg_temp.probe('service_oauth_completion','select pg_temp.verify_oauth()','00000',1);
select pg_temp.probe('service_plan_change_authorized','update public.workspaces set plan=''pro'' where id=(select ws from qa_d)','00000',1);
set local role anon;
select pg_temp.probe('anon_complete_oauth_blocked','select pg_temp.oauth(owner_id) from qa_d','42501');
select pg_temp.probe('anon_counter_blocked','select public.bio_register_click(link) from qa_d','42501');
reset role;
select jsonb_build_object('all_passed',bool_and(passed),'passed',count(*) filter(where passed),'failed',count(*) filter(where not passed),'total',count(*),'results',jsonb_agg(to_jsonb(r) order by name)) as result from qa_r r;
rollback;
