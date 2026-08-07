drop policy if exists room_promotions_read on public.room_promotions;

create policy room_promotions_read
on public.room_promotions
for select
to authenticated
using (
  exists (
    select 1
    from public.rooms room
    where room.id = room_promotions.room_id
      and (
        room.category <> 'adult'::public.room_category
        or public.is_system_admin()
        or exists (
          select 1
          from public.users viewer
          where viewer.id = auth.uid()
            and viewer.adult_verified_at is not null
        )
      )
  )
);

create or replace function public.promote_room(p_room_id uuid)
returns table(last_promoted_at timestamptz, next_available_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_result timestamptz;
  v_name text;
  v_is_adult_room boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  if not exists (
    select 1 from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'owner'::public.room_role
  ) then raise exception 'OWNER_ONLY'; end if;

  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.category = 'adult'::public.room_category
  ) into v_is_adult_room;

  if v_is_adult_room and not (
    public.is_system_admin()
    or exists (
      select 1
      from public.users viewer
      where viewer.id = auth.uid()
        and viewer.adult_verified_at is not null
    )
  ) then
    raise exception 'ADULT_VERIFICATION_REQUIRED';
  end if;

  select promotion.last_promoted_at into v_last
  from public.room_promotions promotion
  where promotion.room_id = p_room_id;

  if v_last is not null and v_last + interval '15 minutes' > now() then
    raise exception 'PROMOTION_COOLDOWN:%',
      extract(epoch from (v_last + interval '15 minutes' - now()))::integer;
  end if;

  insert into public.room_promotions(room_id, last_promoted_at, promotion_count, updated_at)
  values (p_room_id, now(), 1, now())
  on conflict (room_id) do update
  set last_promoted_at = excluded.last_promoted_at,
      promotion_count = public.room_promotions.promotion_count + 1,
      updated_at = now()
  returning public.room_promotions.last_promoted_at into v_result;

  select coalesce(nullif(trim(profile.display_name), ''), '방장') into v_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id, auth.uid(), 'system',
    coalesce(v_name, '방장') || '님이 프로모션을 돌렸습니다.'
  );

  update public.rooms room set updated_at = now() where room.id = p_room_id;

  last_promoted_at := v_result;
  next_available_at := v_result + interval '15 minutes';
  return next;
end;
$$;

revoke all on function public.promote_room(uuid) from public;
grant execute on function public.promote_room(uuid) to authenticated;

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
  v_is_adult_room boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;

  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.category = 'adult'::public.room_category
  ) into v_is_adult_room;

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

  if p_kind in ('text','secret') and not v_is_adult_room then
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
