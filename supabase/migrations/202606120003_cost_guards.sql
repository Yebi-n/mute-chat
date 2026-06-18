create index if not exists rooms_updated_at_live
  on public.rooms(updated_at desc)
  where deleted_at is null;

create or replace function public.request_room_join(
  p_room_id uuid,
  p_name text,
  p_introduction text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from rooms where id = p_room_id and deleted_at is null)
    then raise exception 'ROOM_NOT_FOUND'; end if;
  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id
      and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;

  insert into room_join_requests(room_id, user_id, requested_name, requested_introduction)
  values (p_room_id, v_user_id, trim(p_name), trim(p_introduction));
end;
$$;

grant execute on function public.request_room_join(uuid,text,text) to authenticated;
