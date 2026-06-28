create or replace function public.queue_join_request_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  delete from public.user_notifications notice
  where notice.event_type = 'join_request'
    and notice.data ->> 'roomId' = new.room_id::text
    and notice.data ->> 'requestId' = new.id::text;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    staff.user_id,
    'join_request',
    room.name,
    coalesce(nullif(trim(new.requested_name), ''), '멤버') || '님이 가입신청을 보냈습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'requestId', new.id,
      'roomName', room.name,
      'senderName', coalesce(nullif(trim(new.requested_name), ''), '멤버'),
      'senderAvatarPath', new.requested_avatar_path
    )
  from public.room_memberships staff
  join public.rooms room on room.id = new.room_id
  where staff.room_id = new.room_id
    and staff.status = 'active'
    and staff.role in ('owner', 'cohost');

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    staff.user_id,
    'join_request',
    room.name,
    coalesce(nullif(trim(new.requested_name), ''), '멤버') || '님이 가입신청을 보냈습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'requestId', new.id,
      'roomName', room.name,
      'senderName', coalesce(nullif(trim(new.requested_name), ''), '멤버'),
      'senderAvatarPath', new.requested_avatar_path
    )
  from public.room_memberships staff
  join public.rooms room on room.id = new.room_id
  left join public.room_user_preferences preference
    on preference.room_id = staff.room_id
   and preference.user_id = staff.user_id
  where staff.room_id = new.room_id
    and staff.status = 'active'
    and staff.role in ('owner', 'cohost')
    and coalesce(preference.notifications_enabled, true);

  return new;
end;
$$;

drop trigger if exists on_join_request_queue_push on public.room_join_requests;
create trigger on_join_request_queue_push
after insert or update of status, created_at, requested_name, requested_introduction, requested_avatar_path
on public.room_join_requests
for each row
execute function public.queue_join_request_push();
