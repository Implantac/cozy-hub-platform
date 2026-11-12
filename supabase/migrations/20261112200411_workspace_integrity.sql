-- Preserve the one real owner; reject cross-workspace foreign references.
-- This migration changes rules, not existing users, owners or business rows.

create or replace function public.guard_workspace_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception using errcode = '23514',
      message = 'Workspace identity/ownership cannot be changed by a regular update';
  end if;
  return new;
end $$;
revoke all on function public.guard_workspace_identity() from public, anon, authenticated;
create trigger guard_workspace_identity before update on public.workspaces
  for each row execute function public.guard_workspace_identity();

create or replace function public.guard_primary_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
declare primary_owner uuid;
begin
  if tg_op = 'UPDATE' and
     (new.workspace_id is distinct from old.workspace_id or new.user_id is distinct from old.user_id) then
    raise exception using errcode = '23514', message = 'Membership identity cannot be reassigned';
  end if;
  if tg_op = 'DELETE' then
    select owner_id into primary_owner from public.workspaces where id = old.workspace_id;
    -- During ON DELETE CASCADE the parent is already gone: workspace cleanup is allowed.
    if primary_owner = old.user_id then
      raise exception using errcode = '23514', message = 'The primary owner cannot leave or be removed';
    end if;
    return old;
  end if;
  select owner_id into primary_owner from public.workspaces where id = new.workspace_id;
  if (new.role = 'owner' and new.user_id is distinct from primary_owner) or
     (new.user_id = primary_owner and new.role <> 'owner') then
    raise exception using errcode = '23514', message = 'Membership must preserve the primary workspace owner';
  end if;
  return new;
end $$;
revoke all on function public.guard_primary_owner_membership() from public, anon, authenticated;
create trigger guard_primary_owner_membership before insert or update or delete on public.workspace_members
  for each row execute function public.guard_primary_owner_membership();

-- Bootstrap still runs through handle_workspace_owner (SECURITY DEFINER).
-- Normal team management cannot create, demote or remove owners.
alter policy wm_insert_admin on public.workspace_members with check (
  role <> 'owner' and public.has_workspace_role(workspace_id, array['owner','admin']::public.app_role[])
);
alter policy wm_update_admin on public.workspace_members
  using (role <> 'owner' and user_id <> auth.uid() and
    public.has_workspace_role(workspace_id, array['owner','admin']::public.app_role[]))
  with check (role <> 'owner' and user_id <> auth.uid() and
    public.has_workspace_role(workspace_id, array['owner','admin']::public.app_role[]));
alter policy wm_delete_admin_or_self on public.workspace_members using (
  role <> 'owner' and (user_id = auth.uid() or
    public.has_workspace_role(workspace_id, array['owner','admin']::public.app_role[]))
);
alter policy ws_delete_owner on public.workspaces using (owner_id = auth.uid());

-- Retain the existing FK names so PostgREST joins remain unambiguous.
alter table public.brands add constraint brands_workspace_id_id_key unique (workspace_id,id);
alter table public.content add constraint content_workspace_id_id_key unique (workspace_id,id);
alter table public.channels add constraint channels_workspace_id_id_key unique (workspace_id,id);
alter table public.content drop constraint content_brand_id_fkey,
  add constraint content_brand_id_fkey foreign key (workspace_id,brand_id)
  references public.brands(workspace_id,id) on delete set null (brand_id);
alter table public.channels drop constraint channels_brand_id_fkey,
  add constraint channels_brand_id_fkey foreign key (workspace_id,brand_id)
  references public.brands(workspace_id,id) on delete set null (brand_id);
alter table public.scheduler_jobs drop constraint scheduler_jobs_content_id_fkey,
  add constraint scheduler_jobs_content_id_fkey foreign key (workspace_id,content_id)
  references public.content(workspace_id,id) on delete cascade;
alter table public.scheduler_jobs drop constraint scheduler_jobs_channel_id_fkey,
  add constraint scheduler_jobs_channel_id_fkey foreign key (workspace_id,channel_id)
  references public.channels(workspace_id,id) on delete cascade;

-- ALL/USING membership allowed viewers to DELETE (WITH CHECK never runs on DELETE).
drop policy bio_pages_member_rw on public.bio_pages;
create policy bio_pages_read on public.bio_pages for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy bio_pages_insert on public.bio_pages for insert to authenticated
  with check (public.has_workspace_role(workspace_id,array['owner','admin','editor']::public.app_role[]));
create policy bio_pages_update on public.bio_pages for update to authenticated
  using (public.has_workspace_role(workspace_id,array['owner','admin','editor']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id,array['owner','admin','editor']::public.app_role[]));
create policy bio_pages_delete on public.bio_pages for delete to authenticated
  using (public.has_workspace_role(workspace_id,array['owner','admin','editor']::public.app_role[]));

drop policy bio_links_member_rw on public.bio_links;
create policy bio_links_read on public.bio_links for select to authenticated using (
  exists(select 1 from public.bio_pages p where p.id=page_id and public.is_workspace_member(p.workspace_id))
);
create policy bio_links_insert on public.bio_links for insert to authenticated with check (
  exists(select 1 from public.bio_pages p where p.id=page_id and
    public.has_workspace_role(p.workspace_id,array['owner','admin','editor']::public.app_role[]))
);
create policy bio_links_update on public.bio_links for update to authenticated using (
  exists(select 1 from public.bio_pages p where p.id=page_id and
    public.has_workspace_role(p.workspace_id,array['owner','admin','editor']::public.app_role[]))
) with check (
  exists(select 1 from public.bio_pages p where p.id=page_id and
    public.has_workspace_role(p.workspace_id,array['owner','admin','editor']::public.app_role[]))
);
create policy bio_links_delete on public.bio_links for delete to authenticated using (
  exists(select 1 from public.bio_pages p where p.id=page_id and
    public.has_workspace_role(p.workspace_id,array['owner','admin','editor']::public.app_role[]))
);
