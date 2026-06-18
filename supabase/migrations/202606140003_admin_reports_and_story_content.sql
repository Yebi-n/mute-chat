create table public.story_blocks (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  block_type text not null check (block_type in ('text', 'image')),
  text_content text check (text_content is null or char_length(text_content) <= 5000),
  storage_path text,
  mime_type text check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  position smallint not null check (position between 0 and 49),
  created_at timestamptz not null default now(),
  unique (story_id, position),
  check (
    (block_type = 'text' and text_content is not null and storage_path is null)
    or (block_type = 'image' and storage_path is not null and text_content is null)
  )
);

create table public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index story_comments_story_recent
  on public.story_comments(story_id, created_at desc)
  where deleted_at is null;

alter table public.story_blocks enable row level security;
alter table public.story_comments enable row level security;

create policy story_blocks_read_visible_story on public.story_blocks
  for select using (
    exists (select 1 from public.stories story where story.id = story_blocks.story_id)
  );

create policy story_comments_read_visible_story on public.story_comments
  for select using (
    deleted_at is null
    and exists (select 1 from public.stories story where story.id = story_comments.story_id)
  );

create or replace function public.admin_join_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
begin
  if not public.is_system_admin() then raise exception 'FORBIDDEN'; end if;
  perform 1
  from rooms
  where id = p_room_id and deleted_at is null and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  insert into room_memberships(room_id, user_id, role, status, joined_at, left_at, updated_at)
  values (p_room_id, auth.uid(), 'member', 'active', now(), null, now())
  on conflict (room_id, user_id) do update
    set status = 'active', joined_at = now(), left_at = null, updated_at = now();

  insert into room_profiles(room_id, user_id, display_name, introduction)
  values (p_room_id, auth.uid(), '관리자', '')
  on conflict (room_id, user_id) do nothing;
end;
$$;

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
  v_room rooms%rowtype;
  v_story_id uuid;
  v_block jsonb;
  v_upload media_uploads%rowtype;
  v_position integer := 0;
  v_body text := '';
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_room from rooms where id = p_room_id and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_visibility = 'public' and (v_room.visibility <> 'public' or v_room.category = 'adult')
    then raise exception 'PUBLIC_STORY_NOT_ALLOWED'; end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) < 1
    or jsonb_array_length(p_blocks) > 50 then raise exception 'INVALID_BLOCKS'; end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      v_body := v_body || case when v_body = '' then '' else E'\n' end || trim(v_block ->> 'text');
    end if;
  end loop;
  if char_length(trim(v_body)) < 1 or char_length(v_body) > 5000
    then raise exception 'INVALID_STORY_BODY'; end if;

  insert into stories(room_id, author_user_id, visibility, title, body)
  values (p_room_id, auth.uid(), p_visibility, trim(p_title), v_body)
  returning id into v_story_id;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      insert into story_blocks(story_id, block_type, text_content, position)
      values (v_story_id, 'text', trim(v_block ->> 'text'), v_position);
    elsif v_block ->> 'type' = 'image' then
      select * into v_upload from media_uploads
      where id = (v_block ->> 'uploadId')::uuid
        and owner_user_id = auth.uid()
        and room_id = p_room_id
        and bucket_id = 'chat-media'
        and status = 'validated';
      if not found or v_upload.expected_mime_type = 'image/gif'
        then raise exception 'INVALID_STORY_UPLOAD'; end if;
      insert into story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (v_story_id, 'image', v_upload.object_path, v_upload.expected_mime_type, v_position);
    else
      raise exception 'INVALID_BLOCK_TYPE';
    end if;
    v_position := v_position + 1;
  end loop;
  return v_story_id;
end;
$$;

create or replace function public.add_story_comment(p_story_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story stories%rowtype;
  v_comment_id uuid;
begin
  select * into v_story from stories where id = p_story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if not public.is_active_room_member(v_story.room_id) then raise exception 'FORBIDDEN'; end if;
  insert into story_comments(story_id, author_user_id, body)
  values (p_story_id, auth.uid(), trim(p_body))
  returning id into v_comment_id;
  return v_comment_id;
end;
$$;

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
  v_position integer := 0;
  v_body text := '';
begin
  select * into v_story from stories where id = p_story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      v_body := v_body || case when v_body = '' then '' else E'\n' end || trim(v_block ->> 'text');
    end if;
  end loop;
  if char_length(trim(v_body)) < 1 then raise exception 'INVALID_STORY_BODY'; end if;
  update stories set title = trim(p_title), body = v_body, updated_at = now()
  where id = p_story_id;
  delete from story_blocks where story_id = p_story_id;
  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      insert into story_blocks(story_id, block_type, text_content, position)
      values (p_story_id, 'text', trim(v_block ->> 'text'), v_position);
    else
      insert into story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (
        p_story_id, 'image', v_block ->> 'storagePath',
        coalesce(v_block ->> 'mimeType', 'image/jpeg'), v_position
      );
    end if;
    v_position := v_position + 1;
  end loop;
end;
$$;

create or replace function public.delete_story(p_story_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story stories%rowtype;
begin
  select * into v_story from stories where id = p_story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid()
    and not public.is_room_staff(v_story.room_id)
    and not public.is_system_admin()
    then raise exception 'FORBIDDEN'; end if;
  update stories set deleted_at = now(), updated_at = now() where id = p_story_id;
end;
$$;

grant execute on function public.admin_join_room(uuid) to authenticated;
grant execute on function public.create_story_v2(uuid,public.story_visibility,text,jsonb) to authenticated;
grant execute on function public.add_story_comment(uuid,text) to authenticated;
grant execute on function public.update_story_content(uuid,text,jsonb) to authenticated;
grant execute on function public.delete_story(uuid) to authenticated;
