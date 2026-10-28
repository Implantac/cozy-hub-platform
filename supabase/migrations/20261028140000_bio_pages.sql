-- =========================================================
-- VELT — Link na bio / página pública
--
-- Item 3 do roadmap. É a primeira superfície *anônima* do produto: qualquer
-- pessoa com o link acessa sem sessão. Isso muda o modelo de segurança — até
-- aqui todo acesso era mediado por RLS e `auth.uid()`. Uma página pública não
-- tem usuário, então o isolamento precisa ser explícito no dado, não na policy.
--
-- Princípios adotados:
--   1. Nada é público por padrão. `is_published` começa false.
--   2. A tabela é lida pelo servidor com service-role e filtrada por slug +
--      is_published. Não existe policy de SELECT para `anon`.
--   3. Click tracking é write-only para anônimos e nunca expõe IP/UA brutos.
-- =========================================================

create table if not exists public.bio_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  -- Slug público. Restrito a minúsculas/números/hífen para não gerar URLs
  -- ambíguas nem colidir por caixa.
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,30})[a-z0-9]$'),
  headline text,
  bio text,
  avatar_url text,
  theme text not null default 'aurora' check (theme in ('aurora','minimal','sunset')),
  is_published boolean not null default false,
  seo_title text,
  seo_description text,
  -- Contadores desnormalizados: a página pública não pode fazer count(*) em
  -- analytics a cada visita.
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bio_pages_published on public.bio_pages(is_published) where is_published;

create table if not exists public.bio_links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.bio_pages(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  url text not null check (url ~* '^https?://'),
  kind text not null default 'link' check (kind in ('link','whatsapp','email','phone','product')),
  icon text,
  position integer not null default 0,
  is_active boolean not null default true,
  click_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bio_links_page on public.bio_links(page_id, position);

create table if not exists public.bio_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.bio_links(id) on delete cascade,
  page_id uuid not null references public.bio_pages(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  -- Referrer é guardado só como host (não a URL completa) e o user agent apenas
  -- como família. Guardar o par bruto é dado pessoal que não precisamos ter.
  referrer_host text,
  device text check (device in ('mobile','desktop','tablet','other')),
  country text
);

create index if not exists idx_bio_clicks_page on public.bio_link_clicks(page_id, clicked_at desc);
create index if not exists idx_bio_clicks_link on public.bio_link_clicks(link_id, clicked_at desc);

-- ---------------------------------------------------------
-- RLS: dono do workspace gerencia; anon nunca lê direto.
-- ---------------------------------------------------------
alter table public.bio_pages enable row level security;
alter table public.bio_links enable row level security;
alter table public.bio_link_clicks enable row level security;

drop policy if exists bio_pages_member_rw on public.bio_pages;
create policy bio_pages_member_rw on public.bio_pages
  for all to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.app_role[]));

drop policy if exists bio_links_member_rw on public.bio_links;
create policy bio_links_member_rw on public.bio_links
  for all to authenticated
  using (
    exists (
      select 1 from public.bio_pages p
      where p.id = bio_links.page_id and public.is_workspace_member(p.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.bio_pages p
      where p.id = bio_links.page_id
        and public.has_workspace_role(p.workspace_id, array['owner','admin','editor']::public.app_role[])
    )
  );

-- Cliques: membros leem; anônimos não escrevem direto (o servidor registra via
-- service-role, o que impede spam de linhas pelo endpoint público).
drop policy if exists bio_clicks_member_read on public.bio_link_clicks;
create policy bio_clicks_member_read on public.bio_link_clicks
  for select to authenticated
  using (
    exists (
      select 1 from public.bio_pages p
      where p.id = bio_link_clicks.page_id and public.is_workspace_member(p.workspace_id)
    )
  );

revoke all on public.bio_pages from anon;
revoke all on public.bio_links from anon;
revoke all on public.bio_link_clicks from anon;

-- ---------------------------------------------------------
-- Contadores atômicos. Incrementar em JS (`click_count + 1`) perde cliques
-- sob concorrência; a função resolve no banco.
-- ---------------------------------------------------------
create or replace function public.bio_register_click(
  _link_id uuid,
  _referrer_host text default null,
  _device text default null,
  _country text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _page_id uuid;
begin
  select page_id into _page_id from public.bio_links where id = _link_id and is_active;
  if _page_id is null then
    return;
  end if;

  insert into public.bio_link_clicks (link_id, page_id, referrer_host, device, country)
  values (_link_id, _page_id, _referrer_host, _device, _country);

  update public.bio_links set click_count = click_count + 1 where id = _link_id;
end;
$$;

create or replace function public.bio_register_view(_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  update public.bio_pages
     set view_count = view_count + 1
   where slug = _slug and is_published
  returning id into _id;
  return _id;
end;
$$;

-- Estas funções são chamadas apenas pelo servidor (service-role).
revoke execute on function public.bio_register_click(uuid, text, text, text) from anon, authenticated;
revoke execute on function public.bio_register_view(text) from anon, authenticated;

comment on table public.bio_pages is
  'Página pública de links por workspace. Leitura anônima é feita somente pelo servidor, filtrando is_published.';
