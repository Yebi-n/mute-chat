create or replace function public.update_story_content_v2(
  p_story_id uuid,
  p_visibility public.story_visibility,
  p_title text,
  p_blocks jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story public.stories%rowtype;
  v_room public.rooms%rowtype;
  v_block jsonb;
  v_position integer := 0;
  v_body text := '';
begin
  select * into v_story
  from public.stories
  where id = p_story_id
    and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_room
  from public.rooms
  where id = v_story.room_id
    and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if p_visibility = 'public'
     and (v_room.visibility <> 'public' or v_room.category = 'adult') then
    raise exception 'PUBLIC_STORY_NOT_ALLOWED';
  end if;

  perform public.assert_text_allowed(p_title, 'story_title');
  v_body := public.assert_story_blocks_allowed(p_blocks);

  update public.stories
  set title = trim(p_title),
      body = v_body,
      visibility = coalesce(p_visibility, visibility),
      updated_at = now()
  where id = p_story_id;

  delete from public.story_blocks where story_id = p_story_id;
  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      if length(trim(coalesce(v_block ->> 'text', ''))) > 0 then
        insert into public.story_blocks(story_id, block_type, text_content, position)
        values (p_story_id, 'text', trim(v_block ->> 'text'), v_position);
        v_position := v_position + 1;
      end if;
    elsif coalesce(v_block ->> 'storagePath', '') <> '' then
      insert into public.story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (
        p_story_id,
        'image',
        v_block ->> 'storagePath',
        coalesce(v_block ->> 'mimeType', 'image/jpeg'),
        v_position
      );
      v_position := v_position + 1;
    end if;
  end loop;
end;
$$;

revoke all on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) from public;
grant execute on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) to authenticated;

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
    and membership.status = 'active'
    and membership.user_id <> new.author_user_id
    and coalesce(preference.notifications_enabled, true);

  return new;
end;
$$;

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
  if not found then return new; end if;

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
      from public.room_memberships author_membership
      left join public.room_user_preferences preference
        on preference.room_id = author_membership.room_id
       and preference.user_id = author_membership.user_id
      where author_membership.room_id = v_story.room_id
        and author_membership.user_id = v_story.author_user_id
        and author_membership.status = 'active'
        and coalesce(preference.notifications_enabled, true)
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
      from public.room_memberships author_membership
      left join public.room_user_preferences preference
        on preference.room_id = author_membership.room_id
       and preference.user_id = author_membership.user_id
      where author_membership.room_id = v_story.room_id
        and author_membership.user_id = v_story.author_user_id
        and author_membership.status = 'active'
        and coalesce(preference.notifications_enabled, true)
    );

  return new;
end;
$$;
