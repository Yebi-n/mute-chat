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
  perform public.assert_text_allowed(p_name, 'join_name');
  perform public.assert_text_allowed(p_introduction, 'join_intro');
  if exists (
    select 1 from public.room_bans
    where room_id = p_room_id and user_id = v_user_id and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then
    raise exception 'ROOM_BANNED';
  end if;
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and deleted_at is null and moderation_status = 'active'
  ) then
    raise exception 'ROOM_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;
  if exists (
    select 1 from public.room_join_requests
    where room_id = p_room_id and user_id = v_user_id and status = 'pending'
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.room_join_requests(
    room_id, user_id, requested_name, requested_introduction, status, created_at
  ) values (
    p_room_id, v_user_id, trim(p_name), trim(p_introduction), 'pending', now()
  )
  on conflict (room_id, user_id) where status = 'pending'
  do update
    set requested_name = excluded.requested_name,
        requested_introduction = excluded.requested_introduction,
        created_at = now();
end;
$$;

create or replace function public.request_room_join_v2(
  p_room_id uuid,
  p_name text,
  p_introduction text,
  p_avatar_upload_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category public.room_category;
  v_avatar_path text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.assert_text_allowed(p_name, 'join_name');
  perform public.assert_text_allowed(p_introduction, 'join_intro');
  if exists (
    select 1 from public.room_bans
    where room_id = p_room_id and user_id = v_user_id and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  select category into v_category from public.rooms
  where id = p_room_id and deleted_at is null and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_category = 'adult' and not exists (
    select 1 from public.users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;
  if exists (
    select 1 from public.room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from public.room_join_requests
    where room_id = p_room_id and user_id = v_user_id and status = 'pending'
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;
  if p_avatar_upload_id is not null then
    select object_path into v_avatar_path from public.media_uploads
    where id = p_avatar_upload_id and owner_user_id = v_user_id
      and bucket_id = 'profile-avatars' and status = 'validated';
    if not found then raise exception 'INVALID_AVATAR_UPLOAD'; end if;
  end if;

  insert into public.room_join_requests(
    room_id, user_id, requested_name, requested_introduction, requested_avatar_path, status, created_at
  ) values (
    p_room_id, v_user_id, trim(p_name), trim(p_introduction), v_avatar_path, 'pending', now()
  )
  on conflict (room_id, user_id) where status = 'pending'
  do update
    set requested_name = excluded.requested_name,
        requested_introduction = excluded.requested_introduction,
        requested_avatar_path = excluded.requested_avatar_path,
        created_at = now();
end;
$$;

grant execute on function public.request_room_join(uuid,text,text) to authenticated;
grant execute on function public.request_room_join_v2(uuid,text,text,uuid) to authenticated;
