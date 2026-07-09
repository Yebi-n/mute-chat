create or replace function public.prepare_account_deletion_for_user(
  p_user_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := p_user_id;
  v_room record;
  v_owned_room record;
  v_next_owner uuid;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  insert into public.account_deletion_requests(user_id, requested_at, scheduled_for, cancelled_at, completed_at)
  values (v_user_id, now(), now(), null, now())
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = excluded.completed_at;

  for v_room in
    select room_id, role
    from public.room_memberships
    where user_id = v_user_id
      and status = 'active'::public.membership_status
  loop
    select coalesce(nullif(trim(display_name), ''), '멤버') into v_name
    from public.room_profiles
    where room_id = v_room.room_id and user_id = v_user_id;

    if v_room.role = 'owner'::public.room_role then
      select member.user_id into v_next_owner
      from public.room_memberships member
      where member.room_id = v_room.room_id
        and member.user_id <> v_user_id
        and member.status = 'active'::public.membership_status
      order by
        case member.role when 'cohost'::public.room_role then 0 else 1 end,
        member.joined_at nulls last,
        member.created_at
      limit 1;

      if v_next_owner is null then
        update public.rooms
        set deleted_at = coalesce(deleted_at, now()), updated_at = now()
        where id = v_room.room_id;
      else
        update public.room_memberships
        set role = 'owner'::public.room_role, updated_at = now()
        where room_id = v_room.room_id and user_id = v_next_owner;

        update public.rooms
        set owner_user_id = v_next_owner, updated_at = now()
        where id = v_room.room_id;

        insert into public.messages(room_id, sender_user_id, kind, body)
        values (v_room.room_id, null, 'system', coalesce(v_name, '멤버') || '님이 나가셨습니다.');
      end if;
    else
      insert into public.messages(room_id, sender_user_id, kind, body)
      values (v_room.room_id, null, 'system', coalesce(v_name, '멤버') || '님이 나가셨습니다.');
    end if;

    update public.room_memberships
    set status = 'left'::public.membership_status,
        left_at = coalesce(left_at, now()),
        updated_at = now()
    where room_id = v_room.room_id and user_id = v_user_id;
  end loop;

  for v_owned_room in
    select id
    from public.rooms
    where owner_user_id = v_user_id
      and deleted_at is null
  loop
    select member.user_id into v_next_owner
    from public.room_memberships member
    where member.room_id = v_owned_room.id
      and member.user_id <> v_user_id
      and member.status = 'active'::public.membership_status
    order by
      case member.role when 'cohost'::public.room_role then 0 else 1 end,
      member.joined_at nulls last,
      member.created_at
    limit 1;

    if v_next_owner is null then
      update public.rooms
      set deleted_at = coalesce(deleted_at, now()), updated_at = now()
      where id = v_owned_room.id;
    else
      update public.room_memberships
      set role = 'owner'::public.room_role, updated_at = now()
      where room_id = v_owned_room.id and user_id = v_next_owner;

      update public.rooms
      set owner_user_id = v_next_owner, updated_at = now()
      where id = v_owned_room.id;
    end if;
  end loop;

  delete from public.room_member_mutes
    where user_id = v_user_id
       or created_by_user_id = v_user_id
       or cleared_by_user_id = v_user_id;

  delete from public.room_bans
    where user_id = v_user_id
       or banned_by_user_id = v_user_id
       or revoked_by_user_id = v_user_id;

  delete from public.room_audit_logs
    where actor_user_id = v_user_id
       or target_user_id = v_user_id;

  update public.room_join_requests
    set decided_by_user_id = null
    where decided_by_user_id = v_user_id;

  return now();
end;
$$;

revoke all on function public.prepare_account_deletion_for_user(uuid) from public;
grant execute on function public.prepare_account_deletion_for_user(uuid) to service_role;

create or replace function public.prepare_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_system_admin() then
    raise exception 'ADMIN_ACCOUNT_DELETION_FORBIDDEN';
  end if;

  return public.prepare_account_deletion_for_user(v_user_id);
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

create or replace function public.delete_my_account_admin(
  p_user_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_deleted_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  v_deleted_at := public.prepare_account_deletion_for_user(p_user_id);

  delete from auth.users
  where id = p_user_id;

  return v_deleted_at;
end;
$$;

revoke all on function public.delete_my_account_admin(uuid) from public;
grant execute on function public.delete_my_account_admin(uuid) to service_role;
