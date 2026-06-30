create or replace function public.create_story_v2(
  p_room_id uuid,
  p_visibility public.story_visibility,
  p_title text,
  p_blocks jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_story_id uuid;
  v_block jsonb;
  v_upload public.media_uploads%rowtype;
  v_position integer := 0;
  v_body text := '';
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_room from public.rooms where id = p_room_id and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_visibility = 'public' and v_room.category = 'adult' then
    raise exception 'PUBLIC_STORY_NOT_ALLOWED';
  end if;
  perform public.assert_text_allowed(p_title, 'story_title');
  v_body := public.assert_story_blocks_allowed(p_blocks);

  insert into public.stories(room_id, author_user_id, visibility, title, body)
  values (p_room_id, auth.uid(), p_visibility, trim(p_title), v_body)
  returning id into v_story_id;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      if length(trim(coalesce(v_block ->> 'text', ''))) > 0 then
        insert into public.story_blocks(story_id, block_type, text_content, position)
        values (v_story_id, 'text', trim(v_block ->> 'text'), v_position);
        v_position := v_position + 1;
      end if;
    elsif v_block ->> 'type' = 'image' then
      select * into v_upload from public.media_uploads
      where id = (v_block ->> 'uploadId')::uuid
        and owner_user_id = auth.uid()
        and room_id = p_room_id
        and bucket_id = 'chat-media'
        and status = 'validated';
      if not found or v_upload.expected_mime_type = 'image/gif' then
        raise exception 'INVALID_STORY_UPLOAD';
      end if;
      insert into public.story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (v_story_id, 'image', v_upload.object_path, v_upload.expected_mime_type, v_position);
      v_position := v_position + 1;
    else
      raise exception 'INVALID_BLOCK_TYPE';
    end if;
  end loop;
  return v_story_id;
end;
$$;

revoke all on function public.create_story_v2(uuid, public.story_visibility, text, jsonb) from public;
grant execute on function public.create_story_v2(uuid, public.story_visibility, text, jsonb) to authenticated;

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
  v_upload public.media_uploads%rowtype;
  v_existing_paths text[];
  v_position integer := 0;
  v_body text := '';
begin
  select * into v_story from public.stories
  where id = p_story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;

  select * into v_room from public.rooms
  where id = v_story.room_id and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_visibility = 'public' and v_room.category = 'adult' then
    raise exception 'PUBLIC_STORY_NOT_ALLOWED';
  end if;

  perform public.assert_text_allowed(p_title, 'story_title');
  v_body := public.assert_story_blocks_allowed(p_blocks);
  select coalesce(
    array_agg(storage_path) filter (where storage_path is not null),
    array[]::text[]
  ) into v_existing_paths
  from public.story_blocks
  where story_id = p_story_id;
  update public.stories
  set title = trim(p_title), body = v_body,
      visibility = coalesce(p_visibility, visibility), updated_at = now()
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
    elsif coalesce(v_block ->> 'uploadId', '') <> '' then
      select * into v_upload from public.media_uploads
      where id = (v_block ->> 'uploadId')::uuid
        and owner_user_id = auth.uid()
        and room_id = v_story.room_id
        and bucket_id = 'chat-media'
        and status = 'validated';
      if not found or v_upload.expected_mime_type = 'image/gif' then
        raise exception 'INVALID_STORY_UPLOAD';
      end if;
      insert into public.story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (p_story_id, 'image', v_upload.object_path, v_upload.expected_mime_type, v_position);
      v_position := v_position + 1;
    elsif coalesce(v_block ->> 'storagePath', '') <> ''
      and (v_block ->> 'storagePath') = any(v_existing_paths) then
      insert into public.story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (p_story_id, 'image', v_block ->> 'storagePath',
        coalesce(v_block ->> 'mimeType', 'image/jpeg'), v_position);
      v_position := v_position + 1;
    else
      raise exception 'INVALID_STORY_UPLOAD';
    end if;
  end loop;
end;
$$;

revoke all on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) from public;
grant execute on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) to authenticated;
