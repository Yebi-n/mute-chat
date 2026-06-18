alter table public.room_join_requests
  add column if not exists requested_avatar_path text;

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
  if exists (
    select 1 from room_bans
    where room_id = p_room_id and user_id = v_user_id and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  select category into v_category from rooms
  where id = p_room_id and deleted_at is null and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;
  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;
  if p_avatar_upload_id is not null then
    select object_path into v_avatar_path from media_uploads
    where id = p_avatar_upload_id and owner_user_id = v_user_id
      and bucket_id = 'profile-avatars' and status = 'validated';
    if not found then raise exception 'INVALID_AVATAR_UPLOAD'; end if;
  end if;
  insert into room_join_requests(
    room_id,user_id,requested_name,requested_introduction,requested_avatar_path
  ) values (
    p_room_id,v_user_id,trim(p_name),trim(p_introduction),v_avatar_path
  );
end;
$$;

create or replace function public.set_room_member_role(
  p_room_id uuid,
  p_target_user_id uuid,
  p_role public.room_role
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role not in ('member','cohost') then raise exception 'INVALID_ROLE'; end if;
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = auth.uid()
      and role = 'owner' and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;
  update room_memberships set role = p_role, updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id and status = 'active'
    and role <> 'owner';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
end;
$$;

create or replace function public.transfer_room_ownership(
  p_room_id uuid,
  p_target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = auth.uid()
      and role = 'owner' and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = p_target_user_id and status = 'active'
  ) then raise exception 'MEMBER_NOT_FOUND'; end if;
  update room_memberships set role = 'cohost', updated_at = now()
  where room_id = p_room_id and user_id = auth.uid();
  update room_memberships set role = 'owner', updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id;
  update rooms set owner_user_id = p_target_user_id, updated_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.request_room_join_v2(uuid,text,text,uuid) to authenticated;
grant execute on function public.set_room_member_role(uuid,uuid,public.room_role) to authenticated;
grant execute on function public.transfer_room_ownership(uuid,uuid) to authenticated;

create or replace function public.apply_join_request_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and old.status = 'pending' and new.requested_avatar_path is not null then
    update room_profiles set avatar_asset_path = new.requested_avatar_path, updated_at = now()
    where room_id = new.room_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_join_request_avatar on public.room_join_requests;
create trigger apply_join_request_avatar
after update of status on public.room_join_requests
for each row execute function public.apply_join_request_avatar();
