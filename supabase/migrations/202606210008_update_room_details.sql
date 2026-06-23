create or replace function public.update_room_details(
  p_room_id uuid,
  p_name text,
  p_description text,
  p_category public.room_category,
  p_max_members integer,
  p_region text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_name text;
  v_member_count integer;
begin
  if not public.is_room_staff(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(p_name)) not between 1 and 13 then raise exception 'INVALID_NAME'; end if;
  if char_length(trim(p_description)) not between 1 and 120 then raise exception 'INVALID_DESCRIPTION'; end if;
  if p_max_members not between 1 and 80 then raise exception 'INVALID_MAX_MEMBERS'; end if;

  select count(*) into v_member_count
  from public.room_memberships
  where room_id = p_room_id and status = 'active';
  if p_max_members < v_member_count then raise exception 'MAX_MEMBERS_BELOW_CURRENT_COUNT'; end if;

  update public.rooms
  set name = trim(p_name),
      description = trim(p_description),
      category = p_category,
      max_members = p_max_members,
      region = nullif(trim(p_region), ''),
      updated_at = now()
  where id = p_room_id and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_actor_name
  from public.room_profiles
  where room_id = p_room_id and user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, null, 'system', coalesce(v_actor_name, '멤버') || '님이 방 정보를 수정했습니다.');
end;
$$;

revoke all on function public.update_room_details(uuid,text,text,public.room_category,integer,text) from public;
grant execute on function public.update_room_details(uuid,text,text,public.room_category,integer,text) to authenticated;
