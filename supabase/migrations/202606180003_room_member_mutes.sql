create table if not exists public.room_member_mutes (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  muted_until timestamptz not null,
  created_by_user_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by_user_id uuid references public.users(id),
  primary key (room_id, user_id)
);

create index if not exists room_member_mutes_active
  on public.room_member_mutes(room_id, muted_until desc)
  where cleared_at is null;

alter table public.room_member_mutes enable row level security;

drop policy if exists room_member_mutes_read_related on public.room_member_mutes;
create policy room_member_mutes_read_related on public.room_member_mutes
  for select using (
    public.is_active_room_member(room_id)
    or user_id = auth.uid()
  );

create or replace function public.set_room_member_mute(
  p_room_id uuid,
  p_target_user_id uuid,
  p_duration_seconds integer
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
  v_actor_name text := '멤버';
  v_target_name text := '멤버';
  v_muted_until timestamptz;
  v_duration_label text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_duration_seconds not in (10, 30, 60, 300, 600, 3600) then
    raise exception 'INVALID_MUTE_DURATION';
  end if;

  select role into v_actor_role
  from room_memberships
  where room_id = p_room_id
    and user_id = auth.uid()
    and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role
  from room_memberships
  where room_id = p_room_id
    and user_id = p_target_user_id
    and status = 'active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'CANNOT_MUTE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  v_muted_until := now() + make_interval(secs => p_duration_seconds);
  v_duration_label := case p_duration_seconds
    when 10 then '10초'
    when 30 then '30초'
    when 60 then '1분'
    when 300 then '5분'
    when 600 then '10분'
    else '1시간'
  end;

  select coalesce(display_name, '멤버') into v_actor_name
  from room_profiles
  where room_id = p_room_id and user_id = auth.uid();

  select coalesce(display_name, '멤버') into v_target_name
  from room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;

  insert into room_member_mutes(
    room_id, user_id, muted_until, created_by_user_id, created_at, cleared_at, cleared_by_user_id
  ) values (
    p_room_id, p_target_user_id, v_muted_until, auth.uid(), now(), null, null
  )
  on conflict (room_id, user_id) do update
    set muted_until = excluded.muted_until,
        created_by_user_id = excluded.created_by_user_id,
        created_at = now(),
        cleared_at = null,
        cleared_by_user_id = null;

  insert into messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    v_target_name || '님이 ' || v_duration_label || ' 동안 채팅 금지되었습니다.'
  );

  insert into room_audit_logs(room_id, actor_user_id, target_user_id, action, metadata)
  values (
    p_room_id,
    auth.uid(),
    p_target_user_id,
    'member_muted',
    jsonb_build_object(
      'duration_seconds', p_duration_seconds,
      'duration_label', v_duration_label,
      'actor_name', v_actor_name,
      'target_name', v_target_name
    )
  );

  update rooms set updated_at = now() where id = p_room_id;
  return v_muted_until;
end;
$$;

create or replace function public.clear_room_member_mute(
  p_room_id uuid,
  p_target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
  v_target_name text := '멤버';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select role into v_actor_role
  from room_memberships
  where room_id = p_room_id
    and user_id = auth.uid()
    and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role
  from room_memberships
  where room_id = p_room_id
    and user_id = p_target_user_id
    and status = 'active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'CANNOT_MUTE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  update room_member_mutes
  set muted_until = now(),
      cleared_at = now(),
      cleared_by_user_id = auth.uid()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and cleared_at is null;

  select coalesce(display_name, '멤버') into v_target_name
  from room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;

  insert into messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    v_target_name || '님의 채팅 금지가 해제되었습니다.'
  );

  insert into room_audit_logs(room_id, actor_user_id, target_user_id, action)
  values (p_room_id, auth.uid(), p_target_user_id, 'member_unmuted');

  update rooms set updated_at = now() where id = p_room_id;
end;
$$;

create or replace function public.send_room_message(
  p_room_id uuid,
  p_kind public.message_kind,
  p_body text default '',
  p_reply_to_message_id uuid default null,
  p_secret_recipient_user_id uuid default null,
  p_media_group_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_bans
    where room_id = p_room_id
      and user_id = auth.uid()
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id
      and user_id = auth.uid()
      and cleared_at is null
      and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if p_kind = 'text' and length(trim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if p_kind = 'secret' and (
    p_secret_recipient_user_id is null
    or not exists (
      select 1 from room_memberships
      where room_id = p_room_id
        and user_id = p_secret_recipient_user_id
        and status = 'active'
    )
  ) then raise exception 'INVALID_RECIPIENT'; end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;
  if exists (
    select 1 from messages
    where room_id = p_room_id
      and sender_user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then raise exception 'MESSAGE_RATE_LIMITED'; end if;

  insert into messages(
    room_id, sender_user_id, kind, body, reply_to_message_id,
    secret_recipient_user_id, media_group_id
  ) values (
    p_room_id, auth.uid(), p_kind, trim(p_body), p_reply_to_message_id,
    p_secret_recipient_user_id, p_media_group_id
  ) returning id into v_message_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

create or replace function public.send_image_message(
  p_room_id uuid,
  p_upload_ids uuid[],
  p_reply_to_message_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_media_group_id uuid := gen_random_uuid();
  v_upload_count integer := coalesce(array_length(p_upload_ids, 1), 0);
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id
      and user_id = auth.uid()
      and cleared_at is null
      and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if v_upload_count < 1 or v_upload_count > 5 then raise exception 'INVALID_ASSET_COUNT'; end if;
  if (
    select count(*) <> v_upload_count
    from media_uploads
    where id = any(p_upload_ids)
      and owner_user_id = auth.uid()
      and room_id = p_room_id
      and bucket_id = 'chat-media'
      and status = 'validated'
  ) then raise exception 'INVALID_UPLOAD'; end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;

  insert into messages(
    room_id, sender_user_id, kind, reply_to_message_id, media_group_id
  ) values (
    p_room_id, auth.uid(), 'image', p_reply_to_message_id, v_media_group_id
  ) returning id into v_message_id;

  insert into message_assets(
    message_id, storage_path, mime_type, byte_size, width, height, position
  )
  select
    v_message_id,
    upload.object_path,
    upload.expected_mime_type,
    upload.expected_byte_size,
    upload.expected_width,
    upload.expected_height,
    ordered.ordinality - 1
  from unnest(p_upload_ids) with ordinality as ordered(upload_id, ordinality)
  join media_uploads upload on upload.id = ordered.upload_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

grant execute on function public.set_room_member_mute(uuid,uuid,integer) to authenticated;
grant execute on function public.clear_room_member_mute(uuid,uuid) to authenticated;
grant execute on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.send_image_message(uuid,uuid[],uuid) to authenticated;
