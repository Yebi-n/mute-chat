create or replace function public.send_image_message(
  p_room_id uuid,
  p_upload_ids uuid[],
  p_reply_to_message_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
  v_media_group_id uuid := gen_random_uuid();
  v_upload_count integer := coalesce(array_length(p_upload_ids, 1), 0);
  v_gif_count integer;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id and user_id = auth.uid()
      and cleared_at is null and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if v_upload_count < 1 or v_upload_count > 5 then raise exception 'INVALID_ASSET_COUNT'; end if;
  if (
    select count(*) <> v_upload_count
    from media_uploads
    where id = any(p_upload_ids) and owner_user_id = auth.uid()
      and room_id = p_room_id and bucket_id = 'chat-media' and status = 'validated'
  ) then raise exception 'INVALID_UPLOAD'; end if;

  select count(*) into v_gif_count
  from media_uploads
  where id = any(p_upload_ids) and expected_mime_type = 'image/gif';
  if v_gif_count > 0 and (v_upload_count <> 1 or v_gif_count <> 1) then
    raise exception 'GIF_MUST_BE_SENT_ALONE';
  end if;

  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id and room_id = p_room_id and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;

  insert into messages(room_id, sender_user_id, kind, reply_to_message_id, media_group_id)
  values (p_room_id, auth.uid(), 'image', p_reply_to_message_id, v_media_group_id)
  returning id into v_message_id;

  insert into message_assets(
    message_id, storage_path, mime_type, byte_size, width, height, position
  )
  select v_message_id, upload.object_path, upload.expected_mime_type,
    upload.expected_byte_size, upload.expected_width, upload.expected_height,
    ordered.ordinality - 1
  from unnest(p_upload_ids) with ordinality as ordered(upload_id, ordinality)
  join media_uploads upload on upload.id = ordered.upload_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

revoke all on function public.send_image_message(uuid,uuid[],uuid) from public;
grant execute on function public.send_image_message(uuid,uuid[],uuid) to authenticated;
