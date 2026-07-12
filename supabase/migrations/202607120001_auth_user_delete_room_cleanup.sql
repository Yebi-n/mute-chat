-- Make dashboard/service-role auth user deletion follow the same room cleanup
-- rules as in-app account deletion.

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

  -- Serialize deletion/ownership changes per user.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Handle every room whose canonical owner is the departing user. This does
  -- not rely on a possibly stale membership role.
  for v_room in
    select room.id
    from public.rooms room
    where room.owner_user_id = p_user_id
      and room.deleted_at is null
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
      and member.status = 'active'
      and member.left_at is null
    order by
      case when member.role = 'cohost'::public.room_role then 0 else 1 end,
      random()
    limit 1;

    if v_next_owner is null then
      -- The owner was the only active member. Hard-delete the empty room and
      -- all room-scoped data through existing ON DELETE CASCADE constraints.
      delete from public.rooms where id = v_room.id;
    else
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

      insert into public.messages(room_id, sender_user_id, kind, body)
      values (
        v_room.id,
        null,
        'system'::public.message_kind,
        coalesce(v_next_owner_name, '멤버') || '님이 방장이 되었습니다.'
      );
    end if;
  end loop;

  -- Freeze profile snapshots before public.users cascading deletes remove the
  -- membership/profile rows, then leave every remaining active room.
  for v_room in
    select membership.room_id
    from public.room_memberships membership
    where membership.user_id = p_user_id
      and membership.status = 'active'
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
    set status = 'left'::public.membership_status,
        left_at = now(),
        updated_at = now()
    where room_id = v_room.room_id
      and user_id = p_user_id
      and status = 'active';

    insert into public.messages(room_id, sender_user_id, kind, body)
    values (
      v_room.room_id,
      null,
      'system'::public.message_kind,
      coalesce(v_departing_name, '멤버') || '님이 나가셨습니다.'
    );
  end loop;

  -- Clear non-cascading references that otherwise block auth.users deletion.
  delete from public.room_bans
  where banned_by_user_id = p_user_id
     or revoked_by_user_id = p_user_id;

  delete from public.room_audit_logs
  where actor_user_id = p_user_id
     or target_user_id = p_user_id;

  delete from public.room_member_mutes
  where created_by_user_id = p_user_id
     or cleared_by_user_id = p_user_id;

  update public.room_join_requests
  set decided_by_user_id = null
  where decided_by_user_id = p_user_id;
end;
$$;

revoke all on function public.cleanup_user_room_state(uuid) from public;

create or replace function public.before_auth_user_delete_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform public.cleanup_user_room_state(old.id);
  return old;
end;
$$;

drop trigger if exists before_auth_user_delete_cleanup_trigger on auth.users;
create trigger before_auth_user_delete_cleanup_trigger
before delete on auth.users
for each row
execute function public.before_auth_user_delete_cleanup();

-- Keep in-app deletion behavior aligned with direct dashboard deletion.
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

  insert into public.account_deletion_requests(
    user_id, requested_at, scheduled_for, cancelled_at, completed_at
  )
  values (v_user_id, now(), now(), null, now())
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = excluded.completed_at;

  perform public.cleanup_user_room_state(v_user_id);
  return now();
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
