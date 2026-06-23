create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.room_role;
  v_name text;
begin
  select role into v_role
  from public.room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  for update;

  if v_role is null then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;
  if v_role = 'owner' then
    raise exception 'TRANSFER_OWNERSHIP_REQUIRED';
  end if;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_name
  from public.room_profiles
  where room_id = p_room_id and user_id = auth.uid();

  update public.room_memberships
  set status = 'left', left_at = now(), updated_at = now()
  where room_id = p_room_id and user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, null, 'system', coalesce(v_name, '멤버') || '님이 퇴장했습니다.');
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;

update public.users u
set adult_verified_at = now(), updated_at = now()
from auth.users a
where a.id = u.id and a.email = 'test-alpha@mute.local';

update public.users u
set adult_verified_at = null, updated_at = now()
from auth.users a
where a.id = u.id and a.email = 'test-bravo@mute.local';
