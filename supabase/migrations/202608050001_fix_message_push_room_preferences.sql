create or replace function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
  v_sender_name text;
  v_body text;
begin
  if new.sender_user_id is null then
    return new;
  end if;

  -- Mafia game system notices and private game channels must never leak to
  -- normal push previews.
  if new.kind = 'system'::public.message_kind and new.mafia_game_id is not null then
    return new;
  end if;

  if coalesce(new.mafia_visibility, 'public'::public.mafia_message_visibility)
     <> 'public'::public.mafia_message_visibility then
    return new;
  end if;

  select name
    into v_room_name
  from public.rooms
  where id = new.room_id;

  select coalesce(
      nullif(trim(rp.display_name), ''),
      nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
      '멤버'
    )
    into v_sender_name
  from auth.users u
  left join public.room_profiles rp
    on rp.room_id = new.room_id
   and rp.user_id = new.sender_user_id
  where u.id = new.sender_user_id;

  v_body := case
    when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
    when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
    when new.story_id is not null then '스토리를 올렸습니다.'
    else public.mafia_display_text(nullif(trim(new.body), ''))
  end;

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case
      when new.kind = 'secret'::public.message_kind then 'secret_message'
      else 'message'
    end,
    coalesce(v_room_name, '뮤트'),
    coalesce(v_sender_name, '멤버') || ': ' || coalesce(v_body, '새 메시지'),
    jsonb_build_object(
      'type', 'message',
      'roomId', new.room_id,
      'messageId', new.id
    )
  from public.room_memberships membership
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.left_at is null
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or new.secret_recipient_user_id = membership.user_id
    )
    and exists (
      select 1
      from public.push_devices device
      where device.user_id = membership.user_id
        and device.enabled
    );

  return new;
exception
  when undefined_table or undefined_column then
    -- Keep message sending available even if an emergency rollback leaves push
    -- schema temporarily inconsistent.
    return new;
end;
$$;

drop trigger if exists on_message_queue_push on public.messages;
create trigger on_message_queue_push
  after insert on public.messages
  for each row execute function public.queue_message_push();
