create or replace function public.delete_room_as_owner(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_authorized boolean := false;
  v_updated integer := 0;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.deleted_at is null
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
        or public.is_system_admin()
      )
  ) into v_authorized;

  if not v_authorized then
    if exists (
      select 1
      from public.rooms room
      where room.id = p_room_id
        and room.deleted_at is not null
    ) then
      return;
    end if;

    if not exists (select 1 from public.rooms room where room.id = p_room_id) then
      raise exception 'ROOM_NOT_FOUND';
    end if;

    raise exception 'FORBIDDEN';
  end if;

  update public.rooms room
  set deleted_at = now(),
      updated_at = now()
  where room.id = p_room_id
    and room.deleted_at is null;
  get diagnostics v_updated = row_count;

  if v_updated <> 1 then
    if exists (
      select 1
      from public.rooms room
      where room.id = p_room_id
        and room.deleted_at is not null
    ) then
      return;
    end if;

    raise exception 'ROOM_DELETE_NOT_CONFIRMED';
  end if;

  update public.room_memberships membership
  set status = 'left'::public.membership_status,
      left_at = coalesce(membership.left_at, now()),
      updated_at = now()
  where membership.room_id = p_room_id
    and membership.status = 'active'::public.membership_status;

  update public.room_top_spaces top_space
  set expires_at = least(top_space.expires_at, now())
  where top_space.room_id = p_room_id
    and top_space.expires_at > now();

  delete from public.room_promotions promotion
  where promotion.room_id = p_room_id;
end;
$$;

revoke all on function public.delete_room_as_owner(uuid) from public;
grant execute on function public.delete_room_as_owner(uuid) to authenticated;
