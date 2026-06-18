create or replace function public.is_system_admin()
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select coalesce((
    select is_super_admin
    from auth.users
    where id = auth.uid()
  ), false);
$$;

revoke all on function public.is_system_admin() from public;
grant execute on function public.is_system_admin() to authenticated;

create or replace function public.is_room_staff(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select public.is_system_admin() or exists (
    select 1
    from public.room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'cohost')
  );
$$;

revoke all on function public.is_room_staff(uuid) from public;
grant execute on function public.is_room_staff(uuid) to authenticated;

create or replace function public.admin_delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_system_admin() and not exists (
    select 1
    from public.room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.rooms
  set deleted_at = now(),
      updated_at = now()
  where id = p_room_id
    and deleted_at is null;

  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.admin_delete_room(uuid) from public;
grant execute on function public.admin_delete_room(uuid) to authenticated;
