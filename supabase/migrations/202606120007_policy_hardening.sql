create or replace function public.is_active_room_member(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_room_staff(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'cohost')
  );
$$;

revoke all on function public.is_active_room_member(uuid) from public;
revoke all on function public.is_room_staff(uuid) from public;
grant execute on function public.is_active_room_member(uuid) to authenticated;
grant execute on function public.is_room_staff(uuid) to authenticated;

drop policy if exists memberships_read_related on public.room_memberships;
create policy memberships_read_related on public.room_memberships
  for select using (
    user_id = auth.uid()
    or public.is_active_room_member(room_id)
  );

drop policy if exists join_requests_read_self_or_staff on public.room_join_requests;
create policy join_requests_read_self_or_staff on public.room_join_requests
  for select using (
    user_id = auth.uid()
    or public.is_room_staff(room_id)
  );

drop function if exists public.is_active_room_member(uuid,uuid);
drop function if exists public.is_room_staff(uuid,uuid);

create or replace function public.decide_room_join(
  p_request_id uuid,
  p_approve boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request room_join_requests%rowtype;
  v_active_count integer;
  v_limit integer;
begin
  select * into v_request from room_join_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not exists (
    select 1 from room_memberships
    where room_id = v_request.room_id
      and user_id = v_user_id
      and status = 'active'
      and role in ('owner', 'cohost')
  ) then raise exception 'FORBIDDEN'; end if;

  if p_approve then
    select count(m.id), r.max_members into v_active_count, v_limit
    from rooms r
    left join room_memberships m
      on m.room_id = r.id
      and m.status = 'active'
    where r.id = v_request.room_id
    group by r.max_members;
    if v_active_count >= v_limit then raise exception 'ROOM_FULL'; end if;

    insert into room_memberships(room_id, user_id, role, status, joined_at)
    values (v_request.room_id, v_request.user_id, 'member', 'active', now())
    on conflict (room_id, user_id) do update
      set status = 'active', role = 'member', joined_at = now(), updated_at = now();
    insert into room_profiles(room_id, user_id, display_name, introduction)
    values (v_request.room_id, v_request.user_id, v_request.requested_name, v_request.requested_introduction)
    on conflict (room_id, user_id) do update
      set display_name = excluded.display_name,
          introduction = excluded.introduction,
          updated_at = now();
  end if;

  update room_join_requests
  set status = (
        case when p_approve
          then 'active'::public.membership_status
          else 'rejected'::public.membership_status
        end
      ),
      decided_by_user_id = v_user_id,
      decided_at = now()
  where id = p_request_id;
end;
$$;
