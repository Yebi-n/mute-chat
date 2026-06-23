create or replace function public.list_departed_room_members(p_room_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_asset_path text,
  left_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_room_staff(p_room_id) then raise exception 'FORBIDDEN'; end if;
  return query
  select
    membership.user_id,
    coalesce(nullif(trim(profile.display_name), ''), '멤버'),
    profile.avatar_asset_path,
    membership.left_at
  from public.room_memberships membership
  left join public.room_profiles profile
    on profile.room_id = membership.room_id
   and profile.user_id = membership.user_id
  where membership.room_id = p_room_id
    and membership.status in ('left', 'kicked')
    and membership.user_id <> auth.uid()
    and not exists (
      select 1 from public.room_bans ban
      where ban.room_id = membership.room_id
        and ban.user_id = membership.user_id
        and ban.revoked_at is null
    )
  order by membership.left_at desc nulls last
  limit 100;
end;
$$;

revoke all on function public.list_departed_room_members(uuid) from public;
grant execute on function public.list_departed_room_members(uuid) to authenticated;
