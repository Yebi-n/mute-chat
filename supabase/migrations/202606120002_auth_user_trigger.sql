create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users(id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

insert into public.users(id)
select id from auth.users
on conflict (id) do nothing;

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
  set status = case when p_approve then 'active' else 'rejected' end,
      decided_by_user_id = v_user_id,
      decided_at = now()
  where id = p_request_id;
end;
$$;
