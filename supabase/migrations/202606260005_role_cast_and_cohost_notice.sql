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

grant execute on function public.decide_room_join(uuid, boolean) to authenticated;

create or replace function public.set_room_member_role(
  p_room_id uuid,
  p_target_user_id uuid,
  p_role public.room_role
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_name text;
begin
  if p_role not in ('member'::public.room_role, 'cohost'::public.room_role) then
    raise exception 'INVALID_ROLE';
  end if;

  if not exists (
    select 1 from public.room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'::public.room_role
      and status = 'active'
  ) then
    raise exception 'OWNER_ONLY';
  end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_target_name
  from public.room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;

  update public.room_memberships
  set role = p_role, updated_at = now()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and status = 'active'
    and role <> 'owner'::public.room_role;

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    coalesce(v_target_name, '멤버') || case
      when p_role = 'cohost'::public.room_role then '님이 부방장으로 변경되었습니다.'
      else '님이 부방장에서 해제되었습니다.'
    end
  );

  update public.rooms
  set updated_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.set_room_member_role(uuid, uuid, public.room_role) to authenticated;
