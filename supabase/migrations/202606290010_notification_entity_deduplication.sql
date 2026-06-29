create or replace function public.notification_entity_key(
  p_event_type text,
  p_data jsonb
) returns text
language sql
immutable
set search_path = public
as $$
  select case p_event_type
    when 'join_request' then coalesce(p_data ->> 'requestId', p_data ->> 'joinRequestId')
    when 'story' then p_data ->> 'storyId'
    when 'story_comment' then p_data ->> 'commentId'
    else null
  end;
$$;

create or replace function public.prevent_duplicate_notification_entity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity_key text := public.notification_entity_key(new.event_type, new.data);
begin
  if v_entity_key is null then
    return new;
  end if;

  if tg_table_name = 'push_outbox' and exists (
    select 1
    from public.push_outbox queued
    where queued.recipient_user_id = new.recipient_user_id
      and queued.event_type = new.event_type
      and public.notification_entity_key(queued.event_type, queued.data) = v_entity_key
  ) then
    return null;
  end if;

  if tg_table_name = 'user_notifications' and exists (
    select 1
    from public.user_notifications notice
    where notice.recipient_user_id = new.recipient_user_id
      and notice.event_type = new.event_type
      and public.notification_entity_key(notice.event_type, notice.data) = v_entity_key
  ) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_duplicate_push_entity on public.push_outbox;
create trigger prevent_duplicate_push_entity
before insert on public.push_outbox
for each row execute function public.prevent_duplicate_notification_entity();

drop trigger if exists prevent_duplicate_inbox_entity on public.user_notifications;
create trigger prevent_duplicate_inbox_entity
before insert on public.user_notifications
for each row execute function public.prevent_duplicate_notification_entity();

revoke all on function public.notification_entity_key(text,jsonb) from public;
revoke all on function public.prevent_duplicate_notification_entity() from public;
