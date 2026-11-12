-- The editor offers email/phone: persist only safe destinations of that kind.
alter table public.bio_links drop constraint bio_links_url_check,
  add constraint bio_links_url_check check (
    (kind in ('link','product','whatsapp') and url ~* '^https?://') or
    (kind = 'email' and url ~ '^mailto:[A-Za-z0-9._+-]+@[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?([.][A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$') or
    (kind = 'phone' and url ~ '^tel:[+]?[0-9]{10,15}$')
  );

-- Serialize appends on the parent; max+1 in separate HTTP calls is not atomic.
create or replace function public.add_bio_link(
  _workspace_id uuid, _label text, _url text, _kind text
) returns public.bio_links
language plpgsql security invoker set search_path = public as $$
declare page_uuid uuid; next_position integer; total_links integer; result public.bio_links;
begin
  if not public.has_workspace_role(_workspace_id,array['owner','admin','editor']::public.app_role[]) then
    raise exception using errcode='42501',message='forbidden: insufficient role to edit the bio';
  end if;
  select id into page_uuid from public.bio_pages where workspace_id=_workspace_id for update;
  if page_uuid is null then raise exception 'Crie a página antes de adicionar links.'; end if;
  select count(*),coalesce(max(position),-1)+1 into total_links,next_position
    from public.bio_links where page_id=page_uuid;
  if total_links >= 50 then raise exception 'O limite é de 50 links por página.'; end if;
  insert into public.bio_links(page_id,label,url,kind,position)
    values(page_uuid,_label,_url,_kind,next_position) returning * into result;
  return result;
end $$;
revoke all on function public.add_bio_link(uuid,text,text,text) from public,anon;
grant execute on function public.add_bio_link(uuid,text,text,text) to authenticated;

-- Validate the complete set before one atomic UPDATE; stale/foreign/duplicate IDs fail.
create or replace function public.reorder_bio_links(_workspace_id uuid,_ordered_ids uuid[])
returns integer language plpgsql security invoker set search_path = public as $$
declare page_uuid uuid; total_links integer; changed integer;
begin
  if not public.has_workspace_role(_workspace_id,array['owner','admin','editor']::public.app_role[]) then
    raise exception using errcode='42501',message='forbidden: insufficient role to edit the bio';
  end if;
  if _ordered_ids is null or cardinality(_ordered_ids) not between 1 and 50 or
     exists(select 1 from unnest(_ordered_ids) x where x is null) or
     (select count(distinct x) from unnest(_ordered_ids) x) <> cardinality(_ordered_ids) then
    raise exception 'A ordem deve conter IDs únicos e válidos.';
  end if;
  select id into page_uuid from public.bio_pages where workspace_id=_workspace_id for update;
  if page_uuid is null then raise exception 'Página não encontrada.'; end if;
  select count(*) into total_links from public.bio_links where page_id=page_uuid;
  if total_links <> cardinality(_ordered_ids) or
     (select count(*) from public.bio_links where page_id=page_uuid and id=any(_ordered_ids)) <> total_links then
    raise exception 'A lista de links mudou. Atualize a página e tente novamente.';
  end if;
  update public.bio_links l set position=(o.ordinality-1)::integer
    from unnest(_ordered_ids) with ordinality o(id,ordinality)
    where l.page_id=page_uuid and l.id=o.id;
  get diagnostics changed = row_count;
  if changed <> total_links then raise exception 'Não foi possível confirmar a ordem completa.'; end if;
  return changed;
end $$;
revoke all on function public.reorder_bio_links(uuid,uuid[]) from public,anon;
grant execute on function public.reorder_bio_links(uuid,uuid[]) to authenticated;

-- Availability returns only a boolean; RLS-scoped SELECT cannot see a slug held
-- by another private workspace and would incorrectly advertise it as free.
create or replace function public.bio_slug_available(_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists(select 1 from public.bio_pages where slug=_slug);
$$;
revoke all on function public.bio_slug_available(text) from public,anon;
grant execute on function public.bio_slug_available(text) to authenticated;
