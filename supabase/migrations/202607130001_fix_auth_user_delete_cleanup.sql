-- Fix the cleanup function already installed by 202607120001.
-- The previous version selected only room.id but read room.deleted_at, which
-- could abort dashboard Auth user deletion before ownership was transferred.

create or replace function public.cleanup_user_room_state(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_room record;
  v_next_owner uuid;
  v_departing_name text;
  v_next_owner_name text;
begin
  if p_user_id is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Canonical room ownership is authoritative even when a membership role is
  -- stale. Soft-deleted rooms owned by the departing account are hard-deleted
  -- so their non-cascading owner reference cannot block auth deletion.
  for v_room in
    select room.id, room.deleted_at
    from public.rooms room
    where room.owner_user_id = p_user_id
    order by room.id
    for update
  loop
    if v_room.deleted_at is not null then
      delete from public.rooms where id = v_room.id;
      continue;
    end if;

    v_next_owner := null;
    v_next_owner_name := null;

    select member.user_id
      into v_next_owner
    from public.room_memberships member
    where member.room_id = v_room.id
      and member.user_id <> p_user_id
      and member.status = 'active'::public.membership_status
      and member.left_at is null
    order by
      case when member.role = 'cohost'::public.room_role then 0 else 1 end,
      random()
    limit 1;

    if v_next_owner is null then
      delete from public.rooms where id = v_room.id;
      continue;
    end if;

    select coalesce(nullif(trim(profile.display_name), ''), '멤버')
      into v_next_owner_name
    from public.room_profiles profile
    where profile.room_id = v_room.id
      and profile.user_id = v_next_owner
    limit 1;

    update public.room_memberships
    set role = 'owner'::public.room_role,
        status = 'active'::public.membership_status,
        left_at = null,
        updated_at = now()
    where room_id = v_room.id
      and user_id = v_next_owner;

    update public.rooms
    set owner_user_id = v_next_owner,
        updated_at = now()
    where id = v_room.id;

    begin
      insert into public.messages(room_id, sender_user_id, kind, body)
      values (
        v_room.id,
        null,
        'system'::public.message_kind,
        coalesce(v_next_owner_name, '멤버') || '님이 방장이 되었습니다.'
      );
    exception when others then
      -- Informational notices must not block a required account deletion.
      null;
    end;
  end loop;

  -- Leave all surviving rooms. The membership/profile rows are subsequently
  -- removed by public.users ON DELETE CASCADE.
  for v_room in
    select membership.room_id
    from public.room_memberships membership
    where membership.user_id = p_user_id
      and membership.status = 'active'::public.membership_status
      and membership.left_at is null
  loop
    v_departing_name := null;

    select coalesce(nullif(trim(profile.display_name), ''), '멤버')
      into v_departing_name
    from public.room_profiles profile
    where profile.room_id = v_room.room_id
      and profile.user_id = p_user_id
    limit 1;

    update public.room_memberships
    set role = 'member'::public.room_role,
        status = 'left'::public.membership_status,
        left_at = now(),
        updated_at = now()
    where room_id = v_room.room_id
      and user_id = p_user_id
      and status = 'active'::public.membership_status;

    begin
      insert into public.messages(room_id, sender_user_id, kind, body)
      values (
        v_room.room_id,
        null,
        'system'::public.message_kind,
        coalesce(v_departing_name, '멤버') || '님이 나가셨습니다.'
      );
    exception when others then
      null;
    end;
  end loop;

  -- Remove references without ON DELETE CASCADE/SET NULL.
  delete from public.room_bans
  where user_id = p_user_id
     or banned_by_user_id = p_user_id
     or revoked_by_user_id = p_user_id;

  delete from public.room_audit_logs
  where actor_user_id = p_user_id
     or target_user_id = p_user_id;

  delete from public.room_member_mutes
  where user_id = p_user_id
     or created_by_user_id = p_user_id
     or cleared_by_user_id = p_user_id;

  update public.room_join_requests
  set decided_by_user_id = null
  where decided_by_user_id = p_user_id;
end;
$$;

revoke all on function public.cleanup_user_room_state(uuid) from public;

-- Recreate the trigger explicitly so dashboard deletion always uses the fixed
-- cleanup implementation.
drop trigger if exists before_auth_user_delete_cleanup_trigger on auth.users;
create trigger before_auth_user_delete_cleanup_trigger
before delete on auth.users
for each row
execute function public.before_auth_user_delete_cleanup();

create or replace function public.prepare_account_deletion_for_user(
  p_user_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_now timestamptz := now();
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  insert into public.account_deletion_requests(
    user_id, requested_at, scheduled_for, cancelled_at, completed_at
  )
  values (p_user_id, v_now, v_now, null, v_now)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = excluded.completed_at;

  perform public.cleanup_user_room_state(p_user_id);
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

  if public.is_system_admin() then
    raise exception 'ADMIN_ACCOUNT_DELETION_FORBIDDEN';
  end if;

  return public.prepare_account_deletion_for_user(auth.uid());
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
