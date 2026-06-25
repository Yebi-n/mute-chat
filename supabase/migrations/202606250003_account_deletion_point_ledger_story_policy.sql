create or replace function public.list_my_point_ledger(p_limit integer default 80)
returns table (
  id uuid,
  amount integer,
  reason text,
  reference_id text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ledger.id,
    coalesce(ledger.amount, 0)::integer,
    coalesce(nullif(trim(ledger.reason), ''), 'admin_point')::text,
    ledger.reference_id,
    coalesce(ledger.created_at, now())::timestamptz
  from public.point_ledger ledger
  where ledger.user_id = auth.uid()
  order by coalesce(ledger.created_at, now()) desc, ledger.id desc
  limit greatest(1, least(coalesce(p_limit, 80), 200));
$$;

revoke all on function public.list_my_point_ledger(integer) from public;
grant execute on function public.list_my_point_ledger(integer) to authenticated;

drop policy if exists stories_read_by_visibility on public.stories;
drop policy if exists stories_read_by_visibility_or_admin on public.stories;
create policy stories_read_by_visibility_or_admin on public.stories
  for select using (
    deleted_at is null
    and (
      public.is_system_admin()
      or (visibility = 'room' and public.is_active_room_member(room_id))
      or (
        visibility = 'public'
        and exists (
          select 1 from public.rooms room
          where room.id = stories.room_id
            and room.category <> 'adult'
            and room.deleted_at is null
            and coalesce(room.moderation_status, 'active') = 'active'
        )
      )
    )
  );

create or replace function public.prepare_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text;
  v_blocked_until timestamptz := now() + interval '3 days';
  v_room record;
  v_next_owner uuid;
  v_name text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  if public.is_system_admin() then
    raise exception 'ADMIN_ACCOUNT_DELETION_FORBIDDEN';
  end if;

  select phone into v_phone from auth.users where id = v_user_id;
  if v_phone is null or v_phone = '' then raise exception 'PHONE_REQUIRED'; end if;

  insert into public.account_rejoin_cooldowns(phone_hash, blocked_until, requested_at)
  values (encode(extensions.digest(lower(trim(v_phone)), 'sha256'), 'hex'), v_blocked_until, now())
  on conflict (phone_hash) do update
    set blocked_until = excluded.blocked_until,
        requested_at = excluded.requested_at;

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

  return v_blocked_until;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
