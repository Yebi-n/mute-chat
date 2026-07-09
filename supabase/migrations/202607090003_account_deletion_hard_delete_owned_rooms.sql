create or replace function public.prepare_account_deletion_for_user(p_user_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := p_user_id;
  v_now timestamptz := now();
  v_room record;
  v_owned_room record;
  v_next_owner record;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  insert into public.account_deletion_requests(user_id, requested_at, scheduled_for, cancelled_at, completed_at)
  values (v_user_id, v_now, v_now, null, v_now)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = excluded.completed_at;

  for v_room in
    select
      membership.room_id,
      membership.role,
      coalesce(nullif(trim(profile.display_name), ''), '멤버') as profile_name
    from public.room_memberships membership
    left join public.room_profiles profile
      on profile.room_id = membership.room_id
     and profile.user_id = membership.user_id
    where membership.user_id = v_user_id
      and membership.status = 'active'::public.membership_status
  loop
    v_name := coalesce(v_room.profile_name, '멤버');

    if v_room.role = 'owner'::public.room_role then
      select
        member.user_id,
        member.id as membership_id,
        coalesce(nullif(trim(profile.display_name), ''), '멤버') as name
      into v_next_owner
      from public.room_memberships member
      left join public.room_profiles profile
        on profile.room_id = member.room_id
       and profile.user_id = member.user_id
      where member.room_id = v_room.room_id
        and member.user_id <> v_user_id
        and member.status = 'active'::public.membership_status
      order by
        case when member.role = 'cohost'::public.room_role then 0 else 1 end,
        member.joined_at nulls last,
        member.created_at
      limit 1;

      if v_next_owner.user_id is null then
        delete from public.rooms
        where id = v_room.room_id;
        continue;
      else
        update public.room_memberships
        set role = 'owner'::public.room_role,
            updated_at = v_now
        where id = v_next_owner.membership_id;

        update public.rooms
        set owner_user_id = v_next_owner.user_id,
            updated_at = v_now
        where id = v_room.room_id;

        insert into public.messages(room_id, sender_user_id, kind, body)
        values (
          v_room.room_id,
          null,
          'system'::public.message_kind,
          coalesce(v_next_owner.name, '멤버') || '님이 방장이 되었습니다.'
        );
      end if;
    else
      insert into public.messages(room_id, sender_user_id, kind, body)
      values (
        v_room.room_id,
        null,
        'system'::public.message_kind,
        v_name || '님이 나가셨습니다.'
      );
    end if;

    update public.room_memberships
    set status = 'left'::public.membership_status,
        left_at = coalesce(left_at, v_now),
        updated_at = v_now
    where room_id = v_room.room_id
      and user_id = v_user_id;
  end loop;

  for v_owned_room in
    select id
    from public.rooms
    where owner_user_id = v_user_id
  loop
    select
      member.user_id,
      member.id as membership_id,
      coalesce(nullif(trim(profile.display_name), ''), '멤버') as name
    into v_next_owner
    from public.room_memberships member
    left join public.room_profiles profile
      on profile.room_id = member.room_id
     and profile.user_id = member.user_id
    where member.room_id = v_owned_room.id
      and member.user_id <> v_user_id
      and member.status = 'active'::public.membership_status
    order by
      case when member.role = 'cohost'::public.room_role then 0 else 1 end,
      member.joined_at nulls last,
      member.created_at
    limit 1;

    if v_next_owner.user_id is null then
      delete from public.rooms
      where id = v_owned_room.id;
    else
      update public.room_memberships
      set role = 'owner'::public.room_role,
          updated_at = v_now
      where id = v_next_owner.membership_id;

      update public.rooms
      set owner_user_id = v_next_owner.user_id,
          deleted_at = null,
          updated_at = v_now
      where id = v_owned_room.id;

      update public.room_memberships
      set status = 'left'::public.membership_status,
          left_at = coalesce(left_at, v_now),
          updated_at = v_now
      where room_id = v_owned_room.id
        and user_id = v_user_id;

      insert into public.messages(room_id, sender_user_id, kind, body)
      values (
        v_owned_room.id,
        null,
        'system'::public.message_kind,
        coalesce(v_next_owner.name, '멤버') || '님이 방장이 되었습니다.'
      );
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

  delete from public.rooms
  where owner_user_id = v_user_id;

  return v_now;
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
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return public.prepare_account_deletion_for_user(auth.uid());
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;

create or replace function public.delete_my_account_admin(p_user_id uuid)
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
