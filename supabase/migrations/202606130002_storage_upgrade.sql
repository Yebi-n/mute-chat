alter table public.media_uploads
  add column if not exists expected_width integer not null default 1
    check (expected_width between 1 and 6000),
  add column if not exists expected_height integer not null default 1
    check (expected_height between 1 and 6000);

alter table public.media_uploads
  alter column expected_width drop default,
  alter column expected_height drop default;

create or replace function public.storage_room_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return ((storage.foldername(p_name))[1])::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists room_covers_insert_staff on storage.objects;
create policy room_covers_insert_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'room-covers'
    and public.is_room_staff(public.storage_room_id(name))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists room_covers_update_owner on storage.objects;
create policy room_covers_update_owner on storage.objects
  for update to authenticated
  using (
    bucket_id = 'room-covers'
    and owner_id = auth.uid()::text
  )
  with check (
    bucket_id = 'room-covers'
    and public.is_room_staff(public.storage_room_id(name))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists room_covers_read_allowed on storage.objects;
create policy room_covers_read_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'room-covers'
    and public.can_read_room_media(public.storage_room_id(name))
  );

drop policy if exists chat_media_insert_member on storage.objects;
create policy chat_media_insert_member on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.is_active_room_member(public.storage_room_id(name))
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists chat_media_read_member on storage.objects;
create policy chat_media_read_member on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.is_active_room_member(public.storage_room_id(name))
  );

drop function if exists public.begin_media_upload(text,uuid,text,text,integer);

create or replace function public.begin_media_upload(
  p_bucket_id text,
  p_room_id uuid,
  p_extension text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
) returns table(upload_id uuid, object_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_upload_id uuid := gen_random_uuid();
  v_path text;
  v_extension text := lower(trim(leading '.' from p_extension));
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bucket_id not in ('room-covers', 'chat-media', 'profile-avatars')
    then raise exception 'INVALID_BUCKET'; end if;
  if v_extension not in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    then raise exception 'INVALID_EXTENSION'; end if;
  if p_bucket_id = 'profile-avatars' and (v_extension = 'gif' or p_mime_type = 'image/gif')
    then raise exception 'GIF_NOT_ALLOWED'; end if;
  if p_byte_size < 1 or p_byte_size > (
    case when p_bucket_id = 'profile-avatars' then 2097152 else 10485760 end
  ) then raise exception 'FILE_TOO_LARGE'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
    then raise exception 'INVALID_MIME'; end if;
  if p_width < 1 or p_width > 6000 or p_height < 1 or p_height > 6000
    then raise exception 'INVALID_DIMENSIONS'; end if;

  if p_bucket_id in ('room-covers', 'chat-media') then
    if p_room_id is null then raise exception 'ROOM_REQUIRED'; end if;
    if p_bucket_id = 'room-covers' and not public.is_room_staff(p_room_id)
      then raise exception 'FORBIDDEN'; end if;
    if p_bucket_id = 'chat-media' and not public.is_active_room_member(p_room_id)
      then raise exception 'FORBIDDEN'; end if;
    v_path := p_room_id::text || '/' || v_user_id::text || '/' || v_upload_id::text || '.' || v_extension;
  else
    v_path := v_user_id::text || '/' || v_upload_id::text || '.' || v_extension;
  end if;

  insert into media_uploads(
    id, owner_user_id, room_id, bucket_id, object_path,
    expected_mime_type, expected_byte_size, expected_width, expected_height
  ) values (
    v_upload_id, v_user_id, p_room_id, p_bucket_id, v_path,
    p_mime_type, p_byte_size, p_width, p_height
  );

  return query select v_upload_id, v_path;
end;
$$;

grant execute on function public.begin_media_upload(text,uuid,text,text,integer,integer,integer) to authenticated;

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
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if v_upload_count < 1 or v_upload_count > 5 then raise exception 'INVALID_ASSET_COUNT'; end if;
  if (
    select count(*) <> v_upload_count
    from media_uploads
    where id = any(p_upload_ids)
      and owner_user_id = auth.uid()
      and room_id = p_room_id
      and bucket_id = 'chat-media'
      and status = 'validated'
  ) then raise exception 'INVALID_UPLOAD'; end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;

  insert into messages(
    room_id, sender_user_id, kind, reply_to_message_id, media_group_id
  ) values (
    p_room_id, auth.uid(), 'image', p_reply_to_message_id, v_media_group_id
  ) returning id into v_message_id;

  insert into message_assets(
    message_id, storage_path, mime_type, byte_size, width, height, position
  )
  select
    v_message_id,
    upload.object_path,
    upload.expected_mime_type,
    upload.expected_byte_size,
    upload.expected_width,
    upload.expected_height,
    ordered.ordinality - 1
  from unnest(p_upload_ids) with ordinality as ordered(upload_id, ordinality)
  join media_uploads upload on upload.id = ordered.upload_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

grant execute on function public.send_image_message(uuid,uuid[],uuid) to authenticated;
