create or replace function public.check_phone_signup_status(
  p_phone text
)
returns table (
  can_signup boolean,
  reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_phone text := lower(trim(coalesce(p_phone, '')));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_phone = '' or v_digits = '' then
    return query select false, 'invalid_phone';
    return;
  end if;

  if exists (
    select 1
    from auth.users auth_user
    where lower(trim(coalesce(auth_user.phone, ''))) = v_phone
       or regexp_replace(coalesce(auth_user.phone, ''), '\D', '', 'g') = v_digits
       or lower(trim(coalesce(auth_user.raw_user_meta_data->>'phone', ''))) = v_phone
       or regexp_replace(coalesce(auth_user.raw_user_meta_data->>'phone', ''), '\D', '', 'g') = v_digits
  ) then
    return query select false, 'exists';
    return;
  end if;

  return query select true, 'ok';
end;
$$;

revoke all on function public.check_phone_signup_status(text) from public;
grant execute on function public.check_phone_signup_status(text) to anon, authenticated;

create or replace function public.set_room_member_role(
  p_room_id uuid,
  p_target_user_id uuid,
  p_role public.room_role
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_name text;
begin
  if p_role not in ('member'::public.room_role, 'cohost'::public.room_role) then
    raise exception 'INVALID_ROLE';
  end if;

  if not exists (
    select 1
    from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'::public.room_role
      and membership.status = 'active'
  ) then
    raise exception 'OWNER_ONLY';
  end if;

  select coalesce(nullif(trim(profile.display_name), ''), '멤버')
    into v_target_name
  from public.room_profiles profile
  where profile.room_id = p_room_id
    and profile.user_id = p_target_user_id;

  update public.room_memberships membership
  set role = p_role,
      updated_at = now()
  where membership.room_id = p_room_id
    and membership.user_id = p_target_user_id
    and membership.status = 'active'
    and membership.role <> 'owner'::public.room_role;

  if not found then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    coalesce(v_target_name, '멤버') ||
      case
        when p_role = 'cohost'::public.room_role then '님이 부방장으로 설정되었습니다.'
        else '님이 부방장으로 해제되었습니다.'
      end
  );

  update public.rooms
  set updated_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.set_room_member_role(uuid, uuid, public.room_role) to authenticated;

create or replace function public.transfer_room_ownership(
  p_room_id uuid,
  p_target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_name text;
begin
  if p_target_user_id = auth.uid() then
    raise exception 'INVALID_TARGET';
  end if;

  if not exists (
    select 1
    from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'::public.room_role
      and membership.status = 'active'
  ) then
    raise exception 'OWNER_ONLY';
  end if;

  if not exists (
    select 1
    from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = p_target_user_id
      and membership.status = 'active'
  ) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  select coalesce(nullif(trim(profile.display_name), ''), '멤버')
    into v_target_name
  from public.room_profiles profile
  where profile.room_id = p_room_id
    and profile.user_id = p_target_user_id;

  update public.room_memberships
  set role = 'cohost'::public.room_role,
      updated_at = now()
  where room_id = p_room_id
    and user_id = auth.uid()
    and status = 'active';

  update public.room_memberships
  set role = 'owner'::public.room_role,
      updated_at = now()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and status = 'active';

  update public.rooms
  set owner_user_id = p_target_user_id,
      updated_at = now()
  where id = p_room_id;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    coalesce(v_target_name, '멤버') || '님이 방장이 되었습니다.'
  );
end;
$$;

grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;
