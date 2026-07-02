create or replace function public.kick_or_ban_room_member(
  p_room_id uuid,
  p_target_user_id uuid,
  p_ban boolean,
  p_reason text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
  v_target_name text;
  v_notice_body text;
begin
  select role into v_actor_role
  from public.room_memberships
  where room_id = p_room_id
    and user_id = auth.uid()
    and status = 'active';

  if v_actor_role not in ('owner', 'cohost') then
    raise exception 'FORBIDDEN';
  end if;

  select role into v_target_role
  from public.room_memberships
  where room_id = p_room_id
    and user_id = p_target_user_id;

  if v_target_role is null then
    raise exception 'MEMBER_NOT_FOUND';
  end if;
  if v_target_role = 'owner' then
    raise exception 'CANNOT_REMOVE_OWNER';
  end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_target_name
  from public.room_profiles
  where room_id = p_room_id
    and user_id = p_target_user_id;

  v_notice_body :=
    coalesce(v_target_name, '멤버') ||
    case
      when p_ban then '님이 차단되었습니다.'
      else '님이 강퇴되었습니다.'
    end;

  update public.room_memberships
  set status = 'kicked',
      left_at = coalesce(left_at, now()),
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_target_user_id;

  if p_ban then
    insert into public.room_bans(
      room_id, user_id, banned_by_user_id, reason, created_at, revoked_at, revoked_by_user_id
    )
    values (p_room_id, p_target_user_id, auth.uid(), trim(p_reason), now(), null, null)
    on conflict (room_id, user_id) do update
      set banned_by_user_id = auth.uid(),
          reason = excluded.reason,
          created_at = now(),
          expires_at = null,
          revoked_at = null,
          revoked_by_user_id = null;
  end if;

  insert into public.room_audit_logs(room_id, actor_user_id, target_user_id, action, metadata)
  values (
    p_room_id,
    auth.uid(),
    p_target_user_id,
    case when p_ban then 'member_banned' else 'member_kicked' end,
    jsonb_build_object('reason', trim(p_reason))
  );

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, null, 'system', v_notice_body);

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    p_target_user_id,
    'room_kicked',
    room.name,
    room.name ||
      case
        when p_ban then '에서 차단되었습니다.'
        else '에서 강퇴되었습니다.'
      end,
    jsonb_build_object(
      'type', 'room_kicked',
      'roomId', p_room_id,
      'roomName', room.name,
      'banned', p_ban
    )
  from public.rooms room
  where room.id = p_room_id;

  update public.rooms set updated_at = now() where id = p_room_id;
end;
$$;

revoke all on function public.kick_or_ban_room_member(uuid, uuid, boolean, text) from public;
grant execute on function public.kick_or_ban_room_member(uuid, uuid, boolean, text) to authenticated;

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
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

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
  order by created_at asc, id asc
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
