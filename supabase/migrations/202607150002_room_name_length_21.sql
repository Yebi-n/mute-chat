-- Allow room titles up to 21 characters in create/update RPCs.

create or replace function public.create_room(
  p_name text,
  p_description text,
  p_category public.room_category,
  p_max_members integer,
  p_region text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  if char_length(trim(coalesce(p_name, ''))) not between 1 and 21 then
    raise exception 'INVALID_ROOM_NAME';
  end if;
  if char_length(trim(coalesce(p_description, ''))) not between 1 and 120 then
    raise exception 'INVALID_ROOM_DESCRIPTION';
  end if;
  if p_max_members is null or p_max_members not between 1 and 80 then
    raise exception 'INVALID_MAX_MEMBERS';
  end if;

  perform public.assert_text_allowed(p_name, 'room_name');
  perform public.assert_text_allowed(p_description, 'room_description');
  if nullif(trim(coalesce(p_region, '')), '') is not null then
    perform public.assert_text_allowed(p_region, 'room_region');
  end if;

  if exists (
    select 1 from public.rooms room
    where room.owner_user_id = v_user_id
      and room.created_at > now() - interval '1 minute'
  ) then raise exception 'ROOM_CREATE_COOLDOWN'; end if;

  if p_category = 'adult' and not exists (
    select 1 from public.users app_user
    where app_user.id = v_user_id and app_user.adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  insert into public.rooms(
    owner_user_id, name, description, category, max_members, region
  ) values (
    v_user_id,
    trim(p_name),
    trim(p_description),
    p_category,
    p_max_members,
    nullif(trim(coalesce(p_region, '')), '')
  ) returning id into v_room_id;

  insert into public.room_memberships(room_id, user_id, role, status, joined_at)
  values (v_room_id, v_user_id, 'owner'::public.room_role, 'active', now());

  return v_room_id;
end;
$$;

revoke all on function public.create_room(text,text,public.room_category,integer,text) from public;
grant execute on function public.create_room(text,text,public.room_category,integer,text) to authenticated;


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
  if char_length(trim(p_name)) not between 1 and 21 then raise exception 'INVALID_NAME'; end if;
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
