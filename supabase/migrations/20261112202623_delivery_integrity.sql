-- Close REST paths which could bypass the real delivery/account lifecycle.
-- Only rules change: no real workspace, account, subscription or business row is updated.
create or replace function public.guard_workspace_plan()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') and coalesce(auth.role(),'') <> 'service_role' then
    if (tg_op='INSERT' and new.plan <> 'free') or
       (tg_op='UPDATE' and new.plan is distinct from old.plan) then
      raise exception using errcode='42501',message='Workspace plans can only be changed by the trusted billing service';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_workspace_plan() from public,anon,authenticated;
create trigger guard_workspace_plan before insert or update on public.workspaces
  for each row execute function public.guard_workspace_plan();

create or replace function public.guard_content_delivery()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('postgres','supabase_admin','service_role') or coalesce(auth.role(),'')='service_role' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode='23514',message='New content must start as a draft';
    end if;
    return new;
  end if;
  if exists(select 1 from public.scheduler_jobs where content_id=old.id and status in ('pending','processing'))
    and exists(select 1 from public.workspaces where id=old.workspace_id) then
    raise exception using errcode='23514',message='Cancele os agendamentos pendentes antes de alterar ou excluir o conteúdo.';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id then
    raise exception using errcode='23514',message='Content identity cannot be reassigned';
  end if;
  if new.status is distinct from old.status and new.status not in ('draft','archived') then
    raise exception using errcode='23514',message='Delivery status is controlled by the publication lifecycle';
  end if;
  return new;
end $$;
revoke all on function public.guard_content_delivery() from public,anon,authenticated;
create trigger guard_content_delivery before insert or update or delete on public.content
  for each row execute function public.guard_content_delivery();

-- Deleting an individual job would silently orphan content in scheduled state.
-- Parent/workspace cascades remain possible; use cancel_publication for pending jobs.
drop policy jobs_delete on public.scheduler_jobs;

-- Metrics are collected by trusted server code, never claimed by a client.
drop policy analytics_insert on public.analytics_snapshots;
alter table public.analytics_snapshots drop constraint analytics_snapshots_channel_id_fkey,
  add constraint analytics_snapshots_channel_id_fkey foreign key(workspace_id,channel_id)
    references public.channels(workspace_id,id) on delete cascade;
alter table public.analytics_snapshots drop constraint analytics_snapshots_content_id_fkey,
  add constraint analytics_snapshots_content_id_fkey foreign key(workspace_id,content_id)
    references public.content(workspace_id,id) on delete cascade;

-- Recheck publication inside the atomic counter too (not just in the HTTP resolver).
create or replace function public.bio_register_click(
  _link_id uuid,_referrer_host text default null,_device text default null,_country text default null
) returns void language plpgsql security definer set search_path=public as $$
declare parent uuid;
begin
  select l.page_id into parent from public.bio_links l join public.bio_pages p on p.id=l.page_id
    where l.id=_link_id and l.is_active and p.is_published for share of l,p;
  if parent is null then return; end if;
  insert into public.bio_link_clicks(link_id,page_id,referrer_host,device,country)
    values(_link_id,parent,left(_referrer_host,253),left(_device,30),left(_country,2));
  update public.bio_links set click_count=click_count+1 where id=_link_id;
end $$;
revoke all on function public.bio_register_click(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.bio_register_click(uuid,text,text,text) to service_role;
