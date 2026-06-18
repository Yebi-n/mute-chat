create or replace function public.set_room_owner_profile(
  p_room_id uuid,
  p_display_name text,
  p_introduction text,
  p_avatar_upload_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar_path text;
begin
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;

  if char_length(trim(p_display_name)) not between 1 and 13 then
    raise exception 'INVALID_DISPLAY_NAME';
  end if;
  if char_length(trim(p_introduction)) > 60 then
    raise exception 'INVALID_INTRODUCTION';
  end if;

  if p_avatar_upload_id is not null then
    select object_path into v_avatar_path
    from media_uploads
    where id = p_avatar_upload_id
      and owner_user_id = auth.uid()
      and bucket_id = 'profile-avatars'
      and status = 'validated';
    if not found then raise exception 'INVALID_AVATAR_UPLOAD'; end if;
  end if;

  insert into room_profiles(room_id, user_id, display_name, introduction, avatar_asset_path, updated_at)
  values (p_room_id, auth.uid(), trim(p_display_name), trim(p_introduction), v_avatar_path, now())
  on conflict (room_id, user_id) do update
  set display_name = excluded.display_name,
      introduction = excluded.introduction,
      avatar_asset_path = coalesce(excluded.avatar_asset_path, room_profiles.avatar_asset_path),
      updated_at = now();
end;
$$;

revoke all on function public.set_room_owner_profile(uuid, text, text, uuid) from public;
grant execute on function public.set_room_owner_profile(uuid, text, text, uuid) to authenticated;

do $$
declare
  v_admin_count integer;
begin
  select count(*)
  into v_admin_count
  from auth.users
  where raw_app_meta_data ->> 'admin_role' = 'super_admin'
    and coalesce((raw_app_meta_data ->> 'is_super_admin')::boolean, false);

  if v_admin_count <> 3 then
    raise exception 'Expected 3 super-admin accounts, found %', v_admin_count;
  end if;

  update public.users app_user
  set point_balance = 9999999,
      updated_at = now()
  from auth.users auth_user
  where app_user.id = auth_user.id
    and auth_user.raw_app_meta_data ->> 'admin_role' = 'super_admin'
    and coalesce((auth_user.raw_app_meta_data ->> 'is_super_admin')::boolean, false);
end
$$;
