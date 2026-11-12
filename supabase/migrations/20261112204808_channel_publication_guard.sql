-- A channel delete cascades jobs; it must not strand content in scheduled state.
-- Disconnecting credentials is separate and never manufactures a cancelled/publication outcome.
create or replace function public.guard_channel_publications()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.workspaces where id=old.workspace_id)
    and exists(select 1 from public.scheduler_jobs where channel_id=old.id and status in ('pending','processing')) then
    raise exception using errcode='23514',message='Cancele os agendamentos pendentes deste canal antes de excluí-lo. Execuções em andamento precisam de confirmação final.';
  end if;
  return old;
end $$;
revoke all on function public.guard_channel_publications() from public,anon,authenticated;
create trigger guard_channel_publications before delete on public.channels
  for each row execute function public.guard_channel_publications();
