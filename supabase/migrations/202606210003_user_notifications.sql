create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_recipient_created_idx
  on public.user_notifications(recipient_user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_read_own on public.user_notifications;
create policy user_notifications_read_own
on public.user_notifications
for select to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own
on public.user_notifications
for update to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

create or replace function public.mark_notification_read(
  p_notification_id uuid
) returns void
language sql
security definer
set search_path = public
as $$
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_user_id = auth.uid();
$$;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.user_notifications
  set read_at = coalesce(read_at, now())
  where recipient_user_id = auth.uid()
    and read_at is null;
$$;

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
    and membership.status = 'active'
    and membership.role in ('owner', 'cohost');

  return new;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
