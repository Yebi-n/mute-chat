create or replace function public.clear_room_cover(
  p_room_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then
    raise exception 'FORBIDDEN';
  end if;

  update public.rooms
  set cover_asset_path = null,
      updated_at = now()
  where id = p_room_id;
end;
$$;

create or replace function public.clear_room_profile_avatar(
  p_room_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.room_profiles
  set avatar_asset_path = null,
      updated_at = now()
  where room_id = p_room_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.clear_room_cover(uuid) from public;
revoke all on function public.clear_room_profile_avatar(uuid) from public;
grant execute on function public.clear_room_cover(uuid) to authenticated;
grant execute on function public.clear_room_profile_avatar(uuid) to authenticated;
