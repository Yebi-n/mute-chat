create or replace function public.cancel_room_join_request(
  p_room_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.room_join_requests%rowtype;
  v_room_name text;
  v_sender_name text;
  v_body text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into v_request
    from public.room_join_requests
   where room_id = p_room_id
     and user_id = v_user_id
     and status = 'pending'
   order by created_at desc
   limit 1
   for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  select name
    into v_room_name
    from public.rooms
   where id = v_request.room_id
     and deleted_at is null;

  if v_room_name is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  v_sender_name := coalesce(nullif(trim(v_request.requested_name), ''), '멤버');
  v_body := v_sender_name || '님이 가입 신청을 취소했습니다.';

  delete from public.user_notifications notice
   where notice.event_type = 'join_request'
     and notice.data ->> 'roomId' = v_request.room_id::text
     and notice.data ->> 'requestId' = v_request.id::text;

  delete from public.push_outbox queued
   where queued.event_type = 'join_request'
     and queued.data ->> 'roomId' = v_request.room_id::text
     and queued.data ->> 'requestId' = v_request.id::text;

  delete from public.room_join_requests
   where id = v_request.id;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (v_request.room_id, null, 'system', v_body);

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    staff.user_id,
    'join_request_cancelled',
    v_room_name,
    v_body,
    jsonb_build_object(
      'type', 'join_request_cancelled',
      'roomId', v_request.room_id,
      'requestId', v_request.id,
      'roomName', v_room_name,
      'senderName', v_sender_name
    )
  from public.room_memberships staff
  where staff.room_id = v_request.room_id
    and staff.status = 'active'
    and staff.role in ('owner', 'cohost')
    and staff.user_id <> v_user_id;

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    staff.user_id,
    'join_request_cancelled',
    v_room_name,
    v_body,
    jsonb_build_object(
      'type', 'join_request_cancelled',
      'roomId', v_request.room_id,
      'requestId', v_request.id,
      'roomName', v_room_name,
      'senderName', v_sender_name
    )
  from public.room_memberships staff
  left join public.room_user_preferences preference
    on preference.room_id = staff.room_id
   and preference.user_id = staff.user_id
  where staff.room_id = v_request.room_id
    and staff.status = 'active'
    and staff.role in ('owner', 'cohost')
    and staff.user_id <> v_user_id
    and coalesce(preference.notifications_enabled, true);
end;
$$;

revoke all on function public.cancel_room_join_request(uuid) from public;
grant execute on function public.cancel_room_join_request(uuid) to authenticated;
