create or replace function public.queue_join_request_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  delete from public.user_notifications notice
  where notice.event_type = 'join_request'
    and notice.read_at is null
    and notice.data->>'joinRequestId' = new.id::text;

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
    and membership.role in ('owner'::public.room_role, 'cohost'::public.room_role);

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
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.role in ('owner'::public.room_role, 'cohost'::public.room_role)
    and coalesce(preference.notifications_enabled, true);

  return new;
end;
$$;

drop trigger if exists on_join_request_queue_push on public.room_join_requests;
create trigger on_join_request_queue_push
after insert or update of status, created_at, requested_name, requested_introduction, requested_avatar_path
on public.room_join_requests
for each row execute function public.queue_join_request_push();

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
  v_join_message_id uuid;
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

  if v_role not in ('owner'::public.room_role, 'cohost'::public.room_role) then
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
    values (v_request.room_id, v_request.user_id, 'member'::public.room_role, 'active', now(), now())
    on conflict (room_id, user_id) do update
      set status = 'active',
          role = case
            when public.room_memberships.role = 'owner'::public.room_role then 'owner'::public.room_role
            else 'member'::public.room_role
          end,
          joined_at = now(),
          updated_at = now();

    insert into public.room_profiles(room_id, user_id, display_name, introduction, avatar_asset_path, updated_at)
    values (
      v_request.room_id,
      v_request.user_id,
      v_name,
      coalesce(v_request.requested_introduction, ''),
      v_request.requested_avatar_path,
      now()
    )
    on conflict (room_id, user_id) do update
      set display_name = excluded.display_name,
          introduction = excluded.introduction,
          avatar_asset_path = coalesce(excluded.avatar_asset_path, public.room_profiles.avatar_asset_path),
          updated_at = now();

    update public.room_join_requests
    set status = 'active'
    where id = p_request_id;

    insert into public.messages(room_id, sender_user_id, kind, body)
    values (v_request.room_id, null, 'system', v_name || '님이 입장하셨습니다.')
    returning id into v_join_message_id;

    insert into public.room_read_receipts(room_id, user_id, last_read_message_id, last_read_at)
    values (v_request.room_id, v_request.user_id, v_join_message_id, now())
    on conflict (room_id, user_id) do update
      set last_read_message_id = excluded.last_read_message_id,
          last_read_at = excluded.last_read_at;
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

grant execute on function public.decide_room_join(uuid, boolean) to authenticated;
