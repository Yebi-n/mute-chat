create or replace function public.update_story_content(
  p_story_id uuid,
  p_title text,
  p_blocks jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story stories%rowtype;
  v_block jsonb;
  v_upload media_uploads%rowtype;
  v_position integer := 0;
  v_body text := '';
  v_existing_paths text[];
begin
  select * into v_story from stories where id = p_story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) < 1
    or jsonb_array_length(p_blocks) > 50 then raise exception 'INVALID_BLOCKS'; end if;

  select coalesce(array_agg(storage_path) filter (where storage_path is not null), '{}')
  into v_existing_paths from story_blocks where story_id = p_story_id;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      v_body := v_body || case when v_body = '' then '' else E'\n' end || trim(v_block ->> 'text');
    end if;
  end loop;
  if char_length(trim(v_body)) < 1 or char_length(v_body) > 5000
    then raise exception 'INVALID_STORY_BODY'; end if;

  update stories set title = trim(p_title), body = v_body, updated_at = now()
  where id = p_story_id;
  delete from story_blocks where story_id = p_story_id;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      insert into story_blocks(story_id, block_type, text_content, position)
      values (p_story_id, 'text', trim(v_block ->> 'text'), v_position);
    elsif nullif(v_block ->> 'uploadId', '') is not null then
      select * into v_upload from media_uploads
      where id = (v_block ->> 'uploadId')::uuid
        and owner_user_id = auth.uid()
        and room_id = v_story.room_id
        and bucket_id = 'chat-media'
        and status = 'validated'
        and expected_mime_type <> 'image/gif';
      if not found then raise exception 'INVALID_STORY_UPLOAD'; end if;
      insert into story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (p_story_id, 'image', v_upload.object_path, v_upload.expected_mime_type, v_position);
    elsif v_block ->> 'storagePath' = any(v_existing_paths) then
      insert into story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (p_story_id, 'image', v_block ->> 'storagePath', coalesce(v_block ->> 'mimeType', 'image/jpeg'), v_position);
    else
      raise exception 'INVALID_STORY_UPLOAD';
    end if;
    v_position := v_position + 1;
  end loop;
end;
$$;
