create or replace function public.unban_room_member(
  p_room_id uuid,
  p_target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_room_staff(p_room_id) then raise exception 'FORBIDDEN'; end if;

  update room_bans
  set revoked_at = now(),
      revoked_by_user_id = auth.uid()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and revoked_at is null;

  if not found then raise exception 'BAN_NOT_FOUND'; end if;

  insert into room_audit_logs(room_id, actor_user_id, target_user_id, action)
  values (p_room_id, auth.uid(), p_target_user_id, 'member_unbanned');
end;
$$;

revoke all on function public.unban_room_member(uuid,uuid) from public;
grant execute on function public.unban_room_member(uuid,uuid) to authenticated;
