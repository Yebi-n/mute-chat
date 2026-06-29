-- Temporary policy change: allow immediate re-signup after account deletion.
-- Keep the cooldown table for future rollback, but stop reading/writing active cooldowns.

delete from public.account_rejoin_cooldowns;

create or replace function public.check_phone_signup_status(
  p_phone text
)
returns table (
  can_signup boolean,
  reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_phone text := lower(trim(coalesce(p_phone, '')));
begin
  if v_phone = '' then
    return query select false, 'invalid_phone';
    return;
  end if;

  if exists (
    select 1
    from auth.users
    where lower(trim(coalesce(phone, ''))) = v_phone
      and encrypted_password is not null
      and encrypted_password <> ''
  ) then
    return query select false, 'exists';
    return;
  end if;

  return query select true, 'ok';
end;
$$;

revoke all on function public.check_phone_signup_status(text) from public;
grant execute on function public.check_phone_signup_status(text) to anon, authenticated;

create or replace function public.prepare_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_room record;
  v_next_owner uuid;
  v_name text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  if public.is_system_admin() then
    raise exception 'ADMIN_ACCOUNT_DELETION_FORBIDDEN';
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
    where user_id = v_user_id and status = 'active'
  loop
    select coalesce(nullif(trim(display_name), ''), '멤버') into v_name
    from public.room_profiles
    where room_id = v_room.room_id and user_id = v_user_id;

    if v_room.role = 'owner' then
      select member.user_id into v_next_owner
      from public.room_memberships member
      where member.room_id = v_room.room_id
        and member.user_id <> v_user_id
        and member.status = 'active'
      order by
        case member.role when 'cohost' then 0 else 1 end,
        member.joined_at nulls last,
        member.created_at
      limit 1;

      if v_next_owner is null then
        delete from public.rooms where id = v_room.room_id;
      else
        update public.room_memberships
        set role = 'owner', updated_at = now()
        where room_id = v_room.room_id and user_id = v_next_owner;

        update public.rooms
        set owner_user_id = v_next_owner, updated_at = now()
        where id = v_room.room_id;

        update public.room_memberships
        set status = 'left', left_at = now(), updated_at = now()
        where room_id = v_room.room_id and user_id = v_user_id;

        insert into public.messages(room_id, sender_user_id, kind, body)
        values (v_room.room_id, null, 'system', coalesce(v_name, '멤버') || '님이 나가셨습니다.');
      end if;
    else
      update public.room_memberships
      set status = 'left', left_at = now(), updated_at = now()
      where room_id = v_room.room_id and user_id = v_user_id;

      insert into public.messages(room_id, sender_user_id, kind, body)
      values (v_room.room_id, null, 'system', coalesce(v_name, '멤버') || '님이 나가셨습니다.');
    end if;
  end loop;

  delete from public.room_bans
    where banned_by_user_id = v_user_id or revoked_by_user_id = v_user_id;
  delete from public.room_audit_logs
    where actor_user_id = v_user_id or target_user_id = v_user_id;
  update public.room_join_requests
    set decided_by_user_id = null
    where decided_by_user_id = v_user_id;

  return now();
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
