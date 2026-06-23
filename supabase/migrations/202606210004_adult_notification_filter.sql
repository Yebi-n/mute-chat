create or replace function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind not in (
    'text'::public.message_kind,
    'image'::public.message_kind,
    'secret'::public.message_kind
  ) then
    return new;
  end if;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case when new.kind = 'secret'::public.message_kind then 'secret_message' else 'chat_message' end,
    coalesce(sender_profile.display_name, '멤버'),
    case
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', 'chat',
      'roomId', new.room_id,
      'messageId', new.id,
      'roomName', room.name,
      'senderName', coalesce(sender_profile.display_name, '멤버')
    )
  from room_memberships membership
  join rooms room on room.id = new.room_id
  left join room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  insert into push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case when new.kind = 'secret'::public.message_kind then 'secret_message' else 'chat_message' end,
    coalesce(sender_profile.display_name, '멤버'),
    case
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', 'chat',
      'roomId', new.room_id,
      'messageId', new.id,
      'roomName', room.name,
      'senderName', coalesce(sender_profile.display_name, '멤버')
    )
  from room_memberships membership
  join rooms room on room.id = new.room_id
  left join room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  return new;
end;
$$;

create or replace function public.queue_join_request_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'join_request',
    room.name,
    new.requested_name || '님이 가입 신청을 보냈습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'joinRequestId', new.id,
      'roomName', room.name,
      'requesterName', new.requested_name
    )
  from room_memberships membership
  join rooms room on room.id = new.room_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');

  insert into push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'join_request',
    room.name,
    new.requested_name || '님이 가입 신청을 보냈습니다.',
    jsonb_build_object(
      'type', 'join_request',
      'roomId', new.room_id,
      'joinRequestId', new.id,
      'roomName', room.name,
      'requesterName', new.requested_name
    )
  from room_memberships membership
  join rooms room on room.id = new.room_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');

  return new;
end;
$$;
