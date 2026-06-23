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
    'secret'::public.message_kind,
    'system'::public.message_kind
  ) then
    return new;
  end if;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case
      when new.story_id is not null then 'story'
      when new.kind = 'system'::public.message_kind then 'room_notice'
      when new.kind = 'secret'::public.message_kind then 'secret_message'
      else 'chat_message'
    end,
    case
      when new.kind = 'system'::public.message_kind and new.story_id is null then room.name
      else coalesce(sender_profile.display_name, '멤버')
    end,
    case
      when new.story_id is not null then '스토리를 올렸습니다.'
      when new.kind = 'system'::public.message_kind then left(coalesce(new.body, ''), 100)
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', case
        when new.story_id is not null then 'story'
        when new.kind = 'system'::public.message_kind then 'room_notice'
        else 'chat'
      end,
      'roomId', new.room_id,
      'messageId', new.id,
      'storyId', new.story_id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(sender_profile.display_name, '멤버'),
      'senderAvatarPath', sender_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and (new.sender_user_id is null or membership.user_id <> new.sender_user_id)
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case
      when new.story_id is not null then 'story'
      when new.kind = 'system'::public.message_kind then 'room_notice'
      when new.kind = 'secret'::public.message_kind then 'secret_message'
      else 'chat_message'
    end,
    case
      when new.kind = 'system'::public.message_kind and new.story_id is null then room.name
      else coalesce(sender_profile.display_name, '멤버')
    end,
    case
      when new.story_id is not null then '스토리를 올렸습니다.'
      when new.kind = 'system'::public.message_kind then left(coalesce(new.body, ''), 100)
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', case
        when new.story_id is not null then 'story'
        when new.kind = 'system'::public.message_kind then 'room_notice'
        else 'chat'
      end,
      'roomId', new.room_id,
      'messageId', new.id,
      'storyId', new.story_id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(sender_profile.display_name, '멤버'),
      'senderAvatarPath', sender_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and (new.sender_user_id is null or membership.user_id <> new.sender_user_id)
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  return new;
end;
$$;
