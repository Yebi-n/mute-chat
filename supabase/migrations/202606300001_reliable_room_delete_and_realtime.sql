create or replace function public.delete_room_as_owner(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_is_authorized boolean := false;
begin
  if v_actor_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and (
        room.owner_user_id = v_actor_id
        or exists (
          select 1
          from public.room_memberships membership
          where membership.room_id = room.id
            and membership.user_id = v_actor_id
            and membership.status = 'active'::public.membership_status
            and membership.role = 'owner'::public.room_role
        )
        or coalesce((
          select account.is_super_admin
          from auth.users account
          where account.id = v_actor_id
        ), false)
      )
  ) into v_is_authorized;

  if not v_is_authorized then
    if exists (select 1 from public.rooms where id = p_room_id and deleted_at is not null) then
      return;
    end if;
    raise exception 'FORBIDDEN';
  end if;

  update public.rooms
  set deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = p_room_id;

  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.room_memberships
  set status = 'left'::public.membership_status,
      left_at = coalesce(left_at, now()),
      updated_at = now()
  where room_id = p_room_id
    and status = 'active'::public.membership_status;

  update public.room_top_spaces
  set expires_at = least(expires_at, now())
  where room_id = p_room_id and expires_at > now();

  delete from public.room_promotions where room_id = p_room_id;
end;
$$;

revoke all on function public.delete_room_as_owner(uuid) from public;
grant execute on function public.delete_room_as_owner(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
