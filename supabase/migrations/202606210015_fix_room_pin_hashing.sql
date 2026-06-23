create or replace function public.configure_room_access(
  p_room_id uuid,
  p_visibility public.room_visibility,
  p_pin text default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_previous public.room_visibility;
begin
  if not public.is_room_staff(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if p_visibility = 'private' and (p_pin is null or p_pin !~ '^[0-9]{6}$') then raise exception 'INVALID_PIN'; end if;

  select visibility into v_previous
  from public.rooms
  where id = p_room_id and deleted_at is null
  for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.rooms
  set visibility = p_visibility,
      pin_hash = case when p_visibility = 'public' then null else extensions.crypt(p_pin, extensions.gen_salt('bf')) end,
      updated_at = now()
  where id = p_room_id;

  if v_previous is distinct from p_visibility then
    insert into public.messages(room_id, sender_user_id, kind, body)
    values (
      p_room_id,
      null,
      'system',
      case when p_visibility = 'private'
        then '방이 비공개로 전환되었습니다.'
        else '방이 공개로 전환되었습니다.'
      end
    );
  end if;
end;
$$;

revoke all on function public.configure_room_access(uuid, public.room_visibility, text) from public;
grant execute on function public.configure_room_access(uuid, public.room_visibility, text) to authenticated;
