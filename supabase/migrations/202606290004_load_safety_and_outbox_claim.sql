-- Query paths used by chat, room lists, stories, notifications, and RLS.
create index if not exists room_memberships_room_active_idx
  on public.room_memberships(room_id, user_id)
  include (role, joined_at)
  where status = 'active';

create index if not exists messages_sender_recent_idx
  on public.messages(sender_user_id, created_at desc)
  where sender_user_id is not null and deleted_at is null;

create index if not exists stories_room_recent_idx
  on public.stories(room_id, created_at desc)
  where deleted_at is null;

create index if not exists stories_visibility_recent_idx
  on public.stories(visibility, created_at desc)
  where deleted_at is null;

create index if not exists story_blocks_story_position_idx
  on public.story_blocks(story_id, position);

create index if not exists story_comments_story_recent_idx
  on public.story_comments(story_id, created_at)
  where deleted_at is null;

create index if not exists user_notifications_unread_idx
  on public.user_notifications(recipient_user_id, created_at desc)
  where read_at is null;

drop index if exists public.push_outbox_pending;
create index push_outbox_pending
  on public.push_outbox(created_at)
  where sent_at is null and failed_at is null;

alter table public.push_outbox
  add column if not exists attempt_count integer not null default 0;

create or replace function public.claim_push_outbox(p_limit integer default 100)
returns setof public.push_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  return query
  with candidates as (
    select queued.id
    from public.push_outbox queued
    where queued.sent_at is null
      and queued.failed_at is null
      and (
        queued.processing_started_at is null
        or queued.processing_started_at < now() - interval '5 minutes'
      )
    order by queued.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  )
  update public.push_outbox queued
  set processing_started_at = now(),
      attempt_count = queued.attempt_count + 1
  from candidates
  where queued.id = candidates.id
  returning queued.*;
end;
$$;

revoke all on function public.claim_push_outbox(integer) from public;
grant execute on function public.claim_push_outbox(integer) to service_role;

create or replace function public.cleanup_transient_operational_data()
returns table(push_rows_deleted bigint, notification_rows_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_push bigint;
  v_notifications bigint;
begin
  delete from public.push_outbox
  where (sent_at is not null and sent_at < now() - interval '7 days')
     or (failed_at is not null and failed_at < now() - interval '14 days');
  get diagnostics v_push = row_count;

  delete from public.user_notifications
  where read_at is not null
    and read_at < now() - interval '90 days';
  get diagnostics v_notifications = row_count;

  return query select v_push, v_notifications;
end;
$$;

revoke all on function public.cleanup_transient_operational_data() from public;
grant execute on function public.cleanup_transient_operational_data() to service_role;

create or replace function public.send_room_message(
  p_room_id uuid,
  p_kind public.message_kind,
  p_body text default '',
  p_reply_to_message_id uuid default null,
  p_secret_recipient_user_id uuid default null,
  p_media_group_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_recent_burst integer;
  v_recent_minute integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_bans
    where room_id = p_room_id
      and user_id = auth.uid()
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id
      and user_id = auth.uid()
      and cleared_at is null
      and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if p_kind = 'text' and length(trim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if length(coalesce(p_body, '')) > 2000 then raise exception 'MESSAGE_TOO_LONG'; end if;

  select
    count(*) filter (where created_at > now() - interval '3 seconds'),
    count(*)
  into v_recent_burst, v_recent_minute
  from public.messages
  where sender_user_id = auth.uid()
    and created_at > now() - interval '1 minute'
    and deleted_at is null;

  if v_recent_burst >= 15 or v_recent_minute >= 100 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;

  if p_kind in ('text','secret') then
    perform public.assert_text_allowed(p_body, 'message');
  end if;
  if p_kind = 'secret' and (
    p_secret_recipient_user_id is null
    or not exists (
      select 1 from room_memberships
      where room_id = p_room_id
        and user_id = p_secret_recipient_user_id
        and status = 'active'
    )
  ) then raise exception 'INVALID_RECIPIENT'; end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;

  insert into messages(
    room_id, sender_user_id, kind, body, reply_to_message_id,
    secret_recipient_user_id, media_group_id
  ) values (
    p_room_id, auth.uid(), p_kind, trim(p_body), p_reply_to_message_id,
    p_secret_recipient_user_id, p_media_group_id
  ) returning id into v_message_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

revoke all on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) from public;
grant execute on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) to authenticated;
