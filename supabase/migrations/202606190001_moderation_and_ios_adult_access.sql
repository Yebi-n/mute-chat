alter table public.users
  add column if not exists adult_content_web_opt_in_at timestamptz,
  add column if not exists ios_adult_content_enabled boolean not null default false;

create table if not exists public.moderation_blocked_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  applies_to text[] not null default array[
    'room_name',
    'room_description',
    'room_profile_name',
    'room_profile_intro',
    'join_name',
    'join_intro',
    'message',
    'story_title',
    'story_body',
    'comment'
  ]::text[],
  is_regex boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (term, is_regex)
);

create index if not exists moderation_blocked_terms_active
  on public.moderation_blocked_terms(active);

alter table public.moderation_blocked_terms enable row level security;

create or replace function public.normalize_moderation_text(p_text text)
returns text
language sql
immutable
as $$
  select lower(coalesce(p_text, ''));
$$;

create or replace function public.assert_text_allowed(
  p_text text,
  p_context text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_text text := public.normalize_moderation_text(trim(coalesce(p_text, '')));
begin
  if v_text = '' then
    return;
  end if;

  if exists (
    select 1
    from public.moderation_blocked_terms blocked
    where blocked.active
      and p_context = any(blocked.applies_to)
      and (
        (not blocked.is_regex and position(public.normalize_moderation_text(blocked.term) in v_text) > 0)
        or (blocked.is_regex and v_text ~* blocked.term)
      )
  ) then
    raise exception 'PROHIBITED_CONTENT';
  end if;
end;
$$;

create or replace function public.assert_story_blocks_allowed(p_blocks jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block jsonb;
  v_body text := '';
begin
  if jsonb_typeof(p_blocks) <> 'array'
    or jsonb_array_length(p_blocks) < 1
    or jsonb_array_length(p_blocks) > 50 then
    raise exception 'INVALID_BLOCKS';
  end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      perform public.assert_text_allowed(v_block ->> 'text', 'story_body');
      v_body := v_body || case when v_body = '' then '' else E'\n' end || trim(v_block ->> 'text');
    elsif v_block ->> 'type' <> 'image' then
      raise exception 'INVALID_BLOCK_TYPE';
    end if;
  end loop;

  if char_length(trim(v_body)) < 1 or char_length(v_body) > 5000 then
    raise exception 'INVALID_STORY_BODY';
  end if;

  return v_body;
end;
$$;

create or replace function public.get_my_content_access_status()
returns table (
  adult_content_web_opted_in boolean,
  ios_adult_content_enabled boolean
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    adult_content_web_opt_in_at is not null,
    users.ios_adult_content_enabled
  from public.users
  where id = auth.uid();
$$;

create or replace function public.set_adult_content_access(
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.users
    where id = auth.uid()
      and adult_verified_at is not null
  ) then
    raise exception 'ADULT_VERIFICATION_REQUIRED';
  end if;

  update public.users
  set adult_content_web_opt_in_at = case
        when p_enabled then coalesce(adult_content_web_opt_in_at, now())
        else adult_content_web_opt_in_at
      end,
      ios_adult_content_enabled = p_enabled,
      updated_at = now()
  where id = auth.uid();
end;
$$;

create or replace function public.create_room(
  p_name text,
  p_description text,
  p_category public.room_category,
  p_max_members integer,
  p_region text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.assert_text_allowed(p_name, 'room_name');
  perform public.assert_text_allowed(p_description, 'room_description');
  if p_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  insert into rooms(owner_user_id, name, description, category, max_members, region)
  values (v_user_id, trim(p_name), trim(p_description), p_category, p_max_members, nullif(trim(p_region), ''))
  returning id into v_room_id;

  insert into room_memberships(room_id, user_id, role, status, joined_at)
  values (v_room_id, v_user_id, 'owner', 'active', now());

  return v_room_id;
end;
$$;

create or replace function public.request_room_join(
  p_room_id uuid,
  p_name text,
  p_introduction text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category public.room_category;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.assert_text_allowed(p_name, 'join_name');
  perform public.assert_text_allowed(p_introduction, 'join_intro');

  select category into v_category
  from rooms
  where id = p_room_id
    and deleted_at is null
    and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_category = 'adult' and not exists (
    select 1 from users
    where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id
      and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;

  insert into room_join_requests(room_id, user_id, requested_name, requested_introduction)
  values (p_room_id, v_user_id, trim(p_name), trim(p_introduction));
end;
$$;

create or replace function public.request_room_join_v2(
  p_room_id uuid,
  p_name text,
  p_introduction text,
  p_avatar_upload_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category public.room_category;
  v_avatar_path text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.assert_text_allowed(p_name, 'join_name');
  perform public.assert_text_allowed(p_introduction, 'join_intro');
  if exists (
    select 1 from room_bans
    where room_id = p_room_id and user_id = v_user_id and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  select category into v_category from rooms
  where id = p_room_id and deleted_at is null and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;
  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;
  if p_avatar_upload_id is not null then
    select object_path into v_avatar_path from media_uploads
    where id = p_avatar_upload_id and owner_user_id = v_user_id
      and bucket_id = 'profile-avatars' and status = 'validated';
    if not found then raise exception 'INVALID_AVATAR_UPLOAD'; end if;
  end if;
  insert into room_join_requests(
    room_id,user_id,requested_name,requested_introduction,requested_avatar_path
  ) values (
    p_room_id,v_user_id,trim(p_name),trim(p_introduction),v_avatar_path
  );
end;
$$;

create or replace function public.set_room_owner_profile(
  p_room_id uuid,
  p_display_name text,
  p_introduction text,
  p_avatar_upload_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avatar_path text;
begin
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;

  if char_length(trim(p_display_name)) not between 1 and 13 then
    raise exception 'INVALID_DISPLAY_NAME';
  end if;
  if char_length(trim(p_introduction)) > 60 then
    raise exception 'INVALID_INTRODUCTION';
  end if;
  perform public.assert_text_allowed(p_display_name, 'room_profile_name');
  perform public.assert_text_allowed(p_introduction, 'room_profile_intro');

  if p_avatar_upload_id is not null then
    select object_path into v_avatar_path
    from media_uploads
    where id = p_avatar_upload_id
      and owner_user_id = auth.uid()
      and bucket_id = 'profile-avatars'
      and status = 'validated';
    if not found then raise exception 'INVALID_AVATAR_UPLOAD'; end if;
  end if;

  insert into room_profiles(room_id, user_id, display_name, introduction, avatar_asset_path, updated_at)
  values (p_room_id, auth.uid(), trim(p_display_name), trim(p_introduction), v_avatar_path, now())
  on conflict (room_id, user_id) do update
  set display_name = excluded.display_name,
      introduction = excluded.introduction,
      avatar_asset_path = coalesce(excluded.avatar_asset_path, room_profiles.avatar_asset_path),
      updated_at = now();
end;
$$;

create or replace function public.send_room_message(
  p_room_id uuid,
  p_kind public.message_kind,
  p_body text default '',
  p_reply_to_message_id uuid default null,
  p_secret_recipient_user_id uuid default null,
  p_media_group_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if exists (
    select 1 from room_bans
    where room_id = p_room_id
      and user_id = auth.uid()
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;
  if exists (
    select 1 from room_member_mutes
    where room_id = p_room_id
      and user_id = auth.uid()
      and cleared_at is null
      and muted_until > now()
  ) then raise exception 'ROOM_MUTED'; end if;
  if p_kind = 'text' and length(trim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
  if p_kind in ('text','secret') then
    perform public.assert_text_allowed(p_body, 'message');
  end if;
  if p_kind = 'secret' and (
    p_secret_recipient_user_id is null
    or not exists (
      select 1 from room_memberships
      where room_id = p_room_id
        and user_id = p_secret_recipient_user_id
        and status = 'active'
    )
  ) then raise exception 'INVALID_RECIPIENT'; end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from messages
    where id = p_reply_to_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_REPLY_TARGET'; end if;
  if exists (
    select 1 from messages
    where room_id = p_room_id
      and sender_user_id = auth.uid()
      and created_at > now() - interval '2 seconds'
  ) then raise exception 'MESSAGE_RATE_LIMITED'; end if;

  insert into messages(
    room_id, sender_user_id, kind, body, reply_to_message_id,
    secret_recipient_user_id, media_group_id
  ) values (
    p_room_id, auth.uid(), p_kind, trim(p_body), p_reply_to_message_id,
    p_secret_recipient_user_id, p_media_group_id
  ) returning id into v_message_id;

  update rooms set updated_at = now() where id = p_room_id;
  return v_message_id;
end;
$$;

create or replace function public.create_story(
  p_room_id uuid,
  p_visibility public.story_visibility,
  p_title text,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_story_id uuid;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  select * into v_room from rooms where id = p_room_id and deleted_at is null;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if p_visibility = 'public' and (
    v_room.visibility <> 'public' or v_room.category = 'adult'
  ) then raise exception 'PUBLIC_STORY_NOT_ALLOWED'; end if;
  perform public.assert_text_allowed(p_title, 'story_title');
  perform public.assert_text_allowed(p_body, 'story_body');

  insert into stories(room_id, author_user_id, visibility, title, body)
  values (p_room_id, auth.uid(), p_visibility, trim(p_title), trim(p_body))
  returning id into v_story_id;
  return v_story_id;
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
  perform public.assert_text_allowed(p_title, 'story_title');
  v_body := public.assert_story_blocks_allowed(p_blocks);

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
  perform public.assert_text_allowed(p_body, 'comment');
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
  perform public.assert_text_allowed(p_title, 'story_title');
  v_body := public.assert_story_blocks_allowed(p_blocks);
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

insert into public.moderation_blocked_terms(term, applies_to, is_regex)
values
  ('씨발', array['message','story_body','comment','room_description','join_intro','room_profile_intro']::text[], false),
  ('병신', array['message','story_body','comment','room_description','join_intro','room_profile_intro']::text[], false),
  ('개새끼', array['message','story_body','comment','room_description','join_intro','room_profile_intro']::text[], false),
  ('죽어', array['message','story_body','comment']::text[], false),
  ('자살', array['message','story_body','comment']::text[], false),
  ('야동', array['message','story_body','comment','room_description']::text[], false),
  ('섹스', array['message','story_body','comment','room_description']::text[], false)
on conflict (term, is_regex) do nothing;

grant execute on function public.normalize_moderation_text(text) to authenticated;
grant execute on function public.assert_text_allowed(text, text) to authenticated;
grant execute on function public.assert_story_blocks_allowed(jsonb) to authenticated;
grant execute on function public.get_my_content_access_status() to authenticated;
grant execute on function public.set_adult_content_access(boolean) to authenticated;
grant execute on function public.create_room(text,text,public.room_category,integer,text) to authenticated;
grant execute on function public.request_room_join(uuid,text,text) to authenticated;
grant execute on function public.request_room_join_v2(uuid,text,text,uuid) to authenticated;
grant execute on function public.set_room_owner_profile(uuid, text, text, uuid) to authenticated;
grant execute on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.create_story(uuid,public.story_visibility,text,text) to authenticated;
grant execute on function public.create_story_v2(uuid,public.story_visibility,text,jsonb) to authenticated;
grant execute on function public.add_story_comment(uuid,text) to authenticated;
grant execute on function public.update_story_content(uuid,text,jsonb) to authenticated;
