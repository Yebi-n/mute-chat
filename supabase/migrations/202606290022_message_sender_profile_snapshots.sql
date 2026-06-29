alter table public.messages
  add column if not exists sender_display_name_snapshot text,
  add column if not exists sender_avatar_asset_path_snapshot text;

update public.messages message
set
  sender_display_name_snapshot = coalesce(
    nullif(trim(message.sender_display_name_snapshot), ''),
    nullif(trim(profile.display_name), '')
  ),
  sender_avatar_asset_path_snapshot = coalesce(
    message.sender_avatar_asset_path_snapshot,
    profile.avatar_asset_path
  )
from public.room_profiles profile
where message.sender_user_id = profile.user_id
  and message.room_id = profile.room_id
  and message.sender_user_id is not null
  and (
    message.sender_display_name_snapshot is null
    or message.sender_avatar_asset_path_snapshot is null
  );

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
  v_recent_burst integer;
  v_recent_minute integer;
  v_sender_name text;
  v_sender_avatar text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
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
  if length(coalesce(p_body, '')) > 2000 then raise exception 'MESSAGE_TOO_LONG'; end if;

  select
    count(*) filter (where created_at > now() - interval '3 seconds'),
    count(*)
  into v_recent_burst, v_recent_minute
  from public.messages
  where sender_user_id = auth.uid()
    and created_at > now() - interval '1 minute'
    and deleted_at is null;

  if v_recent_burst >= 15 or v_recent_minute >= 100 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;

  if p_kind in ('text','secret') then
    perform public.assert_text_allowed(p_body, 'message');
  end if;
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

  select
    coalesce(nullif(trim(display_name), ''), '멤버'),
    avatar_asset_path
  into v_sender_name, v_sender_avatar
  from public.room_profiles
  where room_id = p_room_id
    and user_id = auth.uid();

  insert into messages(
    room_id, sender_user_id, kind, body, reply_to_message_id,
    secret_recipient_user_id, media_group_id,
    sender_display_name_snapshot, sender_avatar_asset_path_snapshot
  ) values (
    p_room_id, auth.uid(), p_kind, trim(p_body), p_reply_to_message_id,
    p_secret_recipient_user_id, p_media_group_id,
    coalesce(v_sender_name, '멤버'), v_sender_avatar
  ) returning id into v_message_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

revoke all on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) from public;
grant execute on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) to authenticated;

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
  v_gif_count integer;
  v_sender_name text;
  v_sender_avatar text;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id and user_id = auth.uid()
      and cleared_at is null and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if v_upload_count < 1 or v_upload_count > 5 then raise exception 'INVALID_ASSET_COUNT'; end if;
  if (
    select count(*) <> v_upload_count
    from media_uploads
    where id = any(p_upload_ids) and owner_user_id = auth.uid()
      and room_id = p_room_id and bucket_id = 'chat-media' and status = 'validated'
  ) then raise exception 'INVALID_UPLOAD'; end if;

  select count(*) into v_gif_count
  from media_uploads
  where id = any(p_upload_ids) and expected_mime_type = 'image/gif';
  if v_gif_count > 0 and (v_upload_count <> 1 or v_gif_count <> 1) then
    raise exception 'GIF_MUST_BE_SENT_ALONE';
  end if;

  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id and room_id = p_room_id and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;

  select
    coalesce(nullif(trim(display_name), ''), '멤버'),
    avatar_asset_path
  into v_sender_name, v_sender_avatar
  from public.room_profiles
  where room_id = p_room_id
    and user_id = auth.uid();

  insert into messages(
    room_id, sender_user_id, kind, reply_to_message_id, media_group_id,
    sender_display_name_snapshot, sender_avatar_asset_path_snapshot
  )
  values (
    p_room_id, auth.uid(), 'image', p_reply_to_message_id, v_media_group_id,
    coalesce(v_sender_name, '멤버'), v_sender_avatar
  )
  returning id into v_message_id;

  insert into message_assets(
    message_id, storage_path, mime_type, byte_size, width, height, position
  )
  select v_message_id, upload.object_path, upload.expected_mime_type,
    upload.expected_byte_size, upload.expected_width, upload.expected_height,
    ordered.ordinality - 1
  from unnest(p_upload_ids) with ordinality as ordered(upload_id, ordinality)
  join media_uploads upload on upload.id = ordered.upload_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

revoke all on function public.send_image_message(uuid,uuid[],uuid) from public;
grant execute on function public.send_image_message(uuid,uuid[],uuid) to authenticated;

create or replace function public.announce_story_created(
  p_story_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story public.stories%rowtype;
  v_message_id uuid;
  v_author_name text;
  v_author_avatar text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_story
  from public.stories
  where id = p_story_id
    and deleted_at is null;

  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not public.is_active_room_member(v_story.room_id) then raise exception 'FORBIDDEN'; end if;

  select id into v_message_id
  from public.messages
  where story_id = p_story_id
    and deleted_at is null
  limit 1;

  if v_message_id is not null then
    return v_message_id;
  end if;

  select
    coalesce(nullif(trim(display_name), ''), '멤버'),
    avatar_asset_path
  into v_author_name, v_author_avatar
  from public.room_profiles
  where room_id = v_story.room_id
    and user_id = auth.uid();

  insert into public.messages(
    room_id, sender_user_id, kind, body, story_id,
    sender_display_name_snapshot, sender_avatar_asset_path_snapshot
  )
  values (
    v_story.room_id,
    auth.uid(),
    'system',
    coalesce(v_author_name, '멤버') || '님이 스토리를 올렸습니다.',
    p_story_id,
    coalesce(v_author_name, '멤버'),
    v_author_avatar
  )
  returning id into v_message_id;

  update public.rooms set updated_at = now() where id = v_story.room_id;
  return v_message_id;
end;
$$;

revoke all on function public.announce_story_created(uuid) from public;
grant execute on function public.announce_story_created(uuid) to authenticated;
