alter table if exists public.mafia_games
  add column if not exists updated_at timestamptz not null default now();

create index if not exists mafia_games_room_active_idx
  on public.mafia_games(room_id, status, created_at desc)
  where status in ('waiting', 'running');

create index if not exists mafia_games_room_updated_idx
  on public.mafia_games(room_id, updated_at desc);

create index if not exists mafia_players_game_user_joined_idx
  on public.mafia_players(game_id, user_id)
  where left_at is null;

create index if not exists mafia_players_game_joined_alive_idx
  on public.mafia_players(game_id, alive)
  where left_at is null;

create index if not exists mafia_actions_lookup_idx
  on public.mafia_actions(game_id, day_number, phase, action_type, created_at desc);

create index if not exists mafia_votes_lookup_idx
  on public.mafia_votes(game_id, day_number, phase, vote_type, target_user_id);

create index if not exists messages_room_mafia_visibility_idx
  on public.messages(room_id, mafia_game_id, mafia_visibility, created_at desc)
  where mafia_game_id is not null and deleted_at is null;

create index if not exists room_member_chat_styles_room_user_idx
  on public.room_member_chat_styles(room_id, user_id);

create or replace function public.active_mafia_game_for_sender(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select game.id
  from public.mafia_games game
  join public.mafia_players player
    on player.game_id = game.id
   and player.user_id = auth.uid()
   and player.left_at is null
  where game.room_id = p_room_id
    and game.status = 'running'
  order by game.created_at desc
  limit 1
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
  v_recent_burst integer;
  v_recent_minute integer;
  v_sender_name text;
  v_sender_avatar text;
  v_mafia_game_id uuid;
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

  if p_kind in ('text', 'image') then
    v_mafia_game_id := public.active_mafia_game_for_sender(p_room_id);
  end if;

  insert into messages(
    room_id, sender_user_id, kind, body, reply_to_message_id,
    secret_recipient_user_id, media_group_id,
    sender_display_name_snapshot, sender_avatar_asset_path_snapshot,
    mafia_game_id, mafia_visibility, mafia_recipient_user_ids
  ) values (
    p_room_id, auth.uid(), p_kind, trim(p_body), p_reply_to_message_id,
    p_secret_recipient_user_id, p_media_group_id,
    coalesce(v_sender_name, '멤버'), v_sender_avatar,
    v_mafia_game_id, 'public', '{}'::uuid[]
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
  v_mafia_game_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
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

  v_mafia_game_id := public.active_mafia_game_for_sender(p_room_id);

  insert into messages(
    room_id, sender_user_id, kind, reply_to_message_id, media_group_id,
    sender_display_name_snapshot, sender_avatar_asset_path_snapshot,
    mafia_game_id, mafia_visibility, mafia_recipient_user_ids
  )
  values (
    p_room_id, auth.uid(), 'image', p_reply_to_message_id, v_media_group_id,
    coalesce(v_sender_name, '멤버'), v_sender_avatar,
    v_mafia_game_id, 'public', '{}'::uuid[]
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
