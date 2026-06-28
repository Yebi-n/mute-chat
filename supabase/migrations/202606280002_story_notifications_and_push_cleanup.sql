create or replace function public.queue_story_created_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'story',
    coalesce(author_profile.display_name, '멤버'),
    '스토리를 올렸습니다.',
    jsonb_build_object(
      'type', 'story',
      'roomId', new.room_id,
      'storyId', new.id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(author_profile.display_name, '멤버'),
      'senderAvatarPath', author_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles author_profile
    on author_profile.room_id = new.room_id
   and author_profile.user_id = new.author_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.user_id <> new.author_user_id
    and coalesce(preference.notifications_enabled, true);

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    'story',
    coalesce(author_profile.display_name, '멤버'),
    '스토리를 올렸습니다.',
    jsonb_build_object(
      'type', 'story',
      'roomId', new.room_id,
      'storyId', new.id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(author_profile.display_name, '멤버'),
      'senderAvatarPath', author_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles author_profile
    on author_profile.room_id = new.room_id
   and author_profile.user_id = new.author_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and membership.user_id <> new.author_user_id
    and coalesce(preference.notifications_enabled, true);

  return new;
end;
$$;

drop trigger if exists on_story_created_queue_push on public.stories;
create trigger on_story_created_queue_push
after insert on public.stories
for each row execute function public.queue_story_created_push();

create or replace function public.queue_story_comment_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story public.stories%rowtype;
  v_room public.rooms%rowtype;
begin
  select * into v_story
  from public.stories
  where id = new.story_id
    and deleted_at is null;

  if not found or v_story.author_user_id is null or v_story.author_user_id = new.author_user_id then
    return new;
  end if;

  select * into v_room
  from public.rooms
  where id = v_story.room_id
    and deleted_at is null;

  if not found or v_room.category = 'adult' then
    return new;
  end if;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    v_story.author_user_id,
    'story_comment',
    coalesce(commenter_profile.display_name, '멤버'),
    '내 스토리에 댓글을 남겼습니다.',
    jsonb_build_object(
      'type', 'story_comment',
      'roomId', v_story.room_id,
      'storyId', v_story.id,
      'commentId', new.id,
      'roomName', v_room.name,
      'roomCoverPath', v_room.cover_asset_path,
      'senderName', coalesce(commenter_profile.display_name, '멤버'),
      'senderAvatarPath', commenter_profile.avatar_asset_path
    )
  from (select 1) seed
  left join public.room_profiles commenter_profile
    on commenter_profile.room_id = v_story.room_id
   and commenter_profile.user_id = new.author_user_id
  where exists (
      select 1
      from public.room_user_preferences preference
      where preference.room_id = v_story.room_id
        and preference.user_id = v_story.author_user_id
        and preference.notifications_enabled
      union all
      select 1
      where not exists (
        select 1
        from public.room_user_preferences preference
        where preference.room_id = v_story.room_id
          and preference.user_id = v_story.author_user_id
      )
    );

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    v_story.author_user_id,
    'story_comment',
    coalesce(commenter_profile.display_name, '멤버'),
    '내 스토리에 댓글을 남겼습니다.',
    jsonb_build_object(
      'type', 'story_comment',
      'roomId', v_story.room_id,
      'storyId', v_story.id,
      'commentId', new.id,
      'roomName', v_room.name,
      'roomCoverPath', v_room.cover_asset_path,
      'senderName', coalesce(commenter_profile.display_name, '멤버'),
      'senderAvatarPath', commenter_profile.avatar_asset_path
    )
  from (select 1) seed
  left join public.room_profiles commenter_profile
    on commenter_profile.room_id = v_story.room_id
   and commenter_profile.user_id = new.author_user_id
  where exists (
      select 1
      from public.room_user_preferences preference
      where preference.room_id = v_story.room_id
        and preference.user_id = v_story.author_user_id
        and preference.notifications_enabled
      union all
      select 1
      where not exists (
        select 1
        from public.room_user_preferences preference
        where preference.room_id = v_story.room_id
          and preference.user_id = v_story.author_user_id
      )
    );

  return new;
end;
$$;

drop trigger if exists on_story_comment_queue_push on public.story_comments;
create trigger on_story_comment_queue_push
after insert on public.story_comments
for each row execute function public.queue_story_comment_push();
