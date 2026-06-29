create or replace function public.keep_notification_inbox_relevant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type not in (
    'join_request',
    'join_approved',
    'join_rejected',
    'room_kicked',
    'story',
    'story_comment'
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists keep_notification_inbox_relevant_trigger
on public.user_notifications;
create trigger keep_notification_inbox_relevant_trigger
before insert on public.user_notifications
for each row execute function public.keep_notification_inbox_relevant();

delete from public.user_notifications notice
where notice.event_type not in (
  'join_request',
  'join_approved',
  'join_rejected',
  'room_kicked',
  'story',
  'story_comment'
);

create or replace function public.queue_join_decision_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
  v_event_type text;
  v_body text;
begin
  if old.status <> 'pending' or new.status not in ('active', 'rejected') then
    return new;
  end if;

  update public.user_notifications notice
  set read_at = coalesce(notice.read_at, now())
  where notice.event_type = 'join_request'
    and coalesce(
      notice.data ->> 'requestId',
      notice.data ->> 'joinRequestId'
    ) = new.id::text;

  delete from public.push_outbox queued
  where queued.sent_at is null
    and queued.failed_at is null
    and queued.event_type = 'join_request'
    and coalesce(
      queued.data ->> 'requestId',
      queued.data ->> 'joinRequestId'
    ) = new.id::text;

  select room.name into v_room_name
  from public.rooms room
  where room.id = new.room_id;

  v_event_type := case when new.status = 'active' then 'join_approved' else 'join_rejected' end;
  v_body := case
    when new.status = 'active' then '가입 신청이 승인되었습니다.'
    else '가입 신청이 거절되었습니다.'
  end;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  values (
    new.user_id,
    v_event_type,
    coalesce(v_room_name, '채팅방'),
    v_body,
    jsonb_build_object(
      'type', v_event_type,
      'roomId', new.room_id,
      'requestId', new.id,
      'roomName', coalesce(v_room_name, '채팅방')
    )
  );

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  values (
    new.user_id,
    v_event_type,
    coalesce(v_room_name, '채팅방'),
    v_body,
    jsonb_build_object(
      'type', v_event_type,
      'roomId', new.room_id,
      'requestId', new.id,
      'roomName', coalesce(v_room_name, '채팅방')
    )
  );

  return new;
end;
$$;

drop trigger if exists on_join_request_decision_notification
on public.room_join_requests;
create trigger on_join_request_decision_notification
after update of status on public.room_join_requests
for each row execute function public.queue_join_decision_notification();

revoke all on function public.keep_notification_inbox_relevant() from public;
revoke all on function public.queue_join_decision_notification() from public;
