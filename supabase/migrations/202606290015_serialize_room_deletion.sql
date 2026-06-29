create or replace function public.delete_room_as_owner(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
  v_is_admin boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  select exists (
    select 1
    from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'owner'::public.room_role
  ) into v_is_owner;

  select public.is_system_admin() into v_is_admin;
  if not coalesce(v_is_owner, false) and not coalesce(v_is_admin, false) then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.rooms room
    where room.id = p_room_id and room.deleted_at is null
  ) then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.rooms room
  set deleted_at = now(), updated_at = now()
  where room.id = p_room_id;

  update public.room_memberships membership
  set status = 'left',
      left_at = coalesce(membership.left_at, now()),
      updated_at = now()
  where membership.room_id = p_room_id
    and membership.status = 'active';

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
