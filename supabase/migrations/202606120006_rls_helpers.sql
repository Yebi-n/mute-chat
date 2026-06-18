create or replace function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = p_user_id
      and status = 'active'
  );
$$;

create or replace function public.is_room_staff(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = p_user_id
      and status = 'active'
      and role in ('owner', 'cohost')
  );
$$;

revoke all on function public.is_active_room_member(uuid,uuid) from public;
revoke all on function public.is_room_staff(uuid,uuid) from public;
grant execute on function public.is_active_room_member(uuid,uuid) to authenticated;
grant execute on function public.is_room_staff(uuid,uuid) to authenticated;

drop policy if exists memberships_read_related on public.room_memberships;
create policy memberships_read_related on public.room_memberships
  for select using (
    user_id = auth.uid()
    or public.is_active_room_member(room_id, auth.uid())
  );

drop policy if exists join_requests_read_self_or_staff on public.room_join_requests;
create policy join_requests_read_self_or_staff on public.room_join_requests
  for select using (
    user_id = auth.uid()
    or public.is_room_staff(room_id, auth.uid())
  );
