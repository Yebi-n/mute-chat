create or replace function public.list_room_members_public(p_room_id uuid)
returns table(
  user_id uuid,
  display_name text,
  introduction text,
  role public.room_role,
  avatar_asset_path text,
  muted_until timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    membership.user_id,
    coalesce(nullif(trim(profile.display_name), ''), '멤버') as display_name,
    coalesce(profile.introduction, '') as introduction,
    membership.role,
    profile.avatar_asset_path,
    mute.muted_until
  from public.room_memberships membership
  left join public.room_profiles profile
    on profile.room_id = membership.room_id
   and profile.user_id = membership.user_id
  left join public.room_member_mutes mute
    on mute.room_id = membership.room_id
   and mute.user_id = membership.user_id
   and mute.cleared_at is null
   and mute.muted_until > now()
  where membership.room_id = p_room_id
    and membership.status = 'active'
  order by
    case membership.role when 'owner' then 0 when 'cohost' then 1 else 2 end,
    membership.joined_at nulls last;
$$;

create or replace function public.mark_room_join_request_notifications_read(
  p_room_id uuid
) returns void
language sql
security definer
set search_path = public
as $$
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where recipient_user_id = auth.uid()
    and read_at is null
    and event_type = 'join_request'
    and data->>'roomId' = p_room_id::text;
$$;

create or replace function public.decide_room_join(
  p_request_id uuid,
  p_approve boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.room_join_requests%rowtype;
  v_role public.room_role;
  v_active_count integer;
  v_limit integer;
  v_name text;
begin
  select * into v_request
  from public.room_join_requests
  where id = p_request_id and status = 'pending'
  for update;

  if v_request.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  select role into v_role
  from public.room_memberships
  where room_id = v_request.room_id
    and user_id = auth.uid()
    and status = 'active';

  if v_role not in ('owner', 'cohost') then
    raise exception 'FORBIDDEN';
  end if;

  v_name := coalesce(nullif(trim(v_request.requested_name), ''), '멤버');

  if p_approve then
    select count(m.id), r.max_members
      into v_active_count, v_limit
    from public.rooms r
    left join public.room_memberships m
      on m.room_id = r.id
     and m.status = 'active'
    where r.id = v_request.room_id
    group by r.max_members;

    if coalesce(v_active_count, 0) >= coalesce(v_limit, 0) then
      raise exception 'ROOM_FULL';
    end if;

    insert into public.room_memberships(room_id, user_id, role, status, joined_at, updated_at)
    values (v_request.room_id, v_request.user_id, 'member', 'active', now(), now())
    on conflict (room_id, user_id) do update
      set status = 'active',
          role = 'member',
          joined_at = coalesce(public.room_memberships.joined_at, now()),
          updated_at = now();

    update public.room_join_requests
    set status = 'active'
    where id = p_request_id;

    insert into public.messages(room_id, sender_user_id, kind, body)
    values (v_request.room_id, null, 'system', v_name || '님이 입장하셨습니다.');
  else
    update public.room_join_requests
    set status = 'rejected'
    where id = p_request_id;
  end if;

  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where event_type = 'join_request'
    and data->>'joinRequestId' = p_request_id::text
    and read_at is null;

  update public.rooms
  set updated_at = now()
  where id = v_request.room_id;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.room_role;
  v_name text;
begin
  select role into v_role
  from public.room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  for update;

  if v_role is null then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;
  if v_role = 'owner' then
    raise exception 'TRANSFER_OWNERSHIP_REQUIRED';
  end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_name
  from public.room_profiles
  where room_id = p_room_id and user_id = auth.uid();

  update public.room_memberships
  set status = 'left', left_at = now(), updated_at = now()
  where room_id = p_room_id and user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, null, 'system', coalesce(v_name, '멤버') || '님이 나가셨습니다.');

  update public.rooms set updated_at = now() where id = p_room_id;
end;
$$;

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
begin
  select role into v_actor_role from public.room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role from public.room_memberships
  where room_id = p_room_id and user_id = p_target_user_id;
  if v_target_role = 'owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_target_name
  from public.room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;

  update public.room_memberships
  set status = 'kicked', left_at = now(), updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id;

  if p_ban then
    insert into public.room_bans(room_id, user_id, banned_by_user_id, reason, created_at, revoked_at, revoked_by_user_id)
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
  values (p_room_id, null, 'system', coalesce(v_target_name, '멤버') || '님이 강퇴당하셨습니다.');

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    p_target_user_id,
    'room_kicked',
    room.name,
    room.name || '에서 강퇴당하셨습니다.',
    jsonb_build_object('type', 'room_kicked', 'roomId', p_room_id, 'roomName', room.name)
  from public.rooms room
  where room.id = p_room_id;

  update public.rooms set updated_at = now() where id = p_room_id;
end;
$$;

create or replace function public.queue_join_request_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'join_request',
    room.name,
    coalesce(nullif(trim(new.requested_name), ''), '멤버') || '님이 가입신청을 요청했습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'joinRequestId', new.id,
      'roomName', room.name,
      'requesterName', new.requested_name
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'join_request',
    room.name,
    coalesce(nullif(trim(new.requested_name), ''), '멤버') || '님이 가입신청을 요청했습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'joinRequestId', new.id,
      'roomName', room.name,
      'requesterName', new.requested_name
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');

  return new;
end;
$$;

revoke all on function public.list_room_members_public(uuid) from public;
revoke all on function public.mark_room_join_request_notifications_read(uuid) from public;
grant execute on function public.list_room_members_public(uuid) to authenticated;
grant execute on function public.mark_room_join_request_notifications_read(uuid) to authenticated;
