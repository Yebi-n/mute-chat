create table public.push_outbox (
  id bigint generated always as identity primary key,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 160),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

create index push_outbox_pending on public.push_outbox(created_at)
  where sent_at is null and failed_at is null;

alter table public.push_outbox enable row level security;

create or replace function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case when new.kind = 'secret' then 'secret_message' else 'chat_message' end,
    room.name,
    case
      when new.kind = 'secret' then '새 비밀 쪽지가 도착했습니다.'
      when new.kind = 'image' then '사진을 보냈습니다.'
      else left(new.body, 100)
    end,
    jsonb_build_object('roomId', new.room_id, 'messageId', new.id)
  from room_memberships membership
  join rooms room on room.id = new.room_id
  left join room_user_preferences preference
    on preference.room_id = membership.room_id
    and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'
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
  insert into push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'join_request',
    room.name,
    new.requested_name || '님이 가입 신청을 보냈습니다.',
    jsonb_build_object('roomId', new.room_id, 'joinRequestId', new.id)
  from room_memberships membership
  join rooms room on room.id = new.room_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');
  return new;
end;
$$;

drop trigger if exists on_message_queue_push on public.messages;
create trigger on_message_queue_push
  after insert on public.messages
  for each row execute function public.queue_message_push();

drop trigger if exists on_join_request_queue_push on public.room_join_requests;
create trigger on_join_request_queue_push
  after insert on public.room_join_requests
  for each row execute function public.queue_join_request_push();
