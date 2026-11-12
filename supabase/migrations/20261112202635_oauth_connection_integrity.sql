-- The callback must commit the channel, encrypted credentials and event together.
-- A former admin or a foreign brand cannot be trusted merely because OAuth started earlier.
create or replace function public.complete_oauth_connection(
  _workspace_id uuid,_actor_id uuid,_brand_id uuid,_platform public.social_platform,
  _external_id text,_handle text,_metadata jsonb,_access_ciphertext text,
  _refresh_ciphertext text,_token_type text,_scope text,_expires_at timestamptz
) returns public.channels
language plpgsql security definer set search_path=public as $$
declare result public.channels;
begin
  perform 1 from public.workspace_members where workspace_id=_workspace_id and user_id=_actor_id
    and role in ('owner','admin') for share;
  if not found then raise exception using errcode='42501',message='OAuth permission was revoked'; end if;
  if _brand_id is not null then
    perform 1 from public.brands where id=_brand_id and workspace_id=_workspace_id for key share;
    if not found then raise exception using errcode='23503',message='Brand does not belong to this workspace'; end if;
  end if;
  if nullif(btrim(_external_id),'') is null or nullif(btrim(_access_ciphertext),'') is null then
    raise exception using errcode='23514',message='A verified external account and encrypted access token are required';
  end if;
  if jsonb_typeof(_metadata) is distinct from 'object' then
    raise exception using errcode='23514',message='Channel metadata must be an object';
  end if;
  insert into public.channels(workspace_id,brand_id,platform,external_id,handle,status,connected_at,metadata)
    values(_workspace_id,_brand_id,_platform,_external_id,_handle,'connected',now(),_metadata)
    on conflict(workspace_id,platform,external_id) do update set
      brand_id=excluded.brand_id,handle=excluded.handle,status=excluded.status,
      connected_at=excluded.connected_at,metadata=excluded.metadata returning * into result;
  insert into public.oauth_tokens(channel_id,access_token_ciphertext,refresh_token_ciphertext,token_type,scope,expires_at)
    values(result.id,_access_ciphertext,_refresh_ciphertext,_token_type,_scope,_expires_at)
    on conflict(channel_id) do update set access_token_ciphertext=excluded.access_token_ciphertext,
      refresh_token_ciphertext=coalesce(excluded.refresh_token_ciphertext,public.oauth_tokens.refresh_token_ciphertext),
      token_type=excluded.token_type,scope=excluded.scope,expires_at=excluded.expires_at;
  insert into public.domain_events(workspace_id,event_type,payload)
    values(_workspace_id,'channel.connected',jsonb_build_object('channel_id',result.id,'platform',_platform));
  return result;
end $$;
revoke all on function public.complete_oauth_connection(uuid,uuid,uuid,public.social_platform,text,text,jsonb,text,text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.complete_oauth_connection(uuid,uuid,uuid,public.social_platform,text,text,jsonb,text,text,text,text,timestamptz)
  to service_role;

create or replace function public.disconnect_oauth_channel(_channel_id uuid)
returns public.channels language plpgsql security definer set search_path=public as $$
declare result public.channels;
begin
  select * into result from public.channels where id=_channel_id for update;
  if result.id is null or not public.has_workspace_role(result.workspace_id,array['owner','admin']::public.app_role[]) then
    raise exception using errcode='42501',message='forbidden: insufficient role to disconnect this channel';
  end if;
  update public.channels set status='disconnected' where id=_channel_id returning * into result;
  delete from public.oauth_tokens where channel_id=_channel_id;
  insert into public.domain_events(workspace_id,event_type,payload)
    values(result.workspace_id,'channel.disconnected',jsonb_build_object('channel_id',result.id));
  return result;
end $$;
revoke all on function public.disconnect_oauth_channel(uuid) from public,anon;
grant execute on function public.disconnect_oauth_channel(uuid) to authenticated;
