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
  if p_kind = 'text' and length(trim(p_body)) = 0 then raise exception 'EMPTY_MESSAGE'; end if;
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

create or replace function public.search_room_messages(
  p_room_id uuid,
  p_query text,
  p_limit integer default 50
) returns table (
  id uuid,
  sender_user_id uuid,
  kind public.message_kind,
  body text,
  reply_to_message_id uuid,
  created_at timestamptz
)
language sql
security invoker
set search_path = public
stable
as $$
  select m.id, m.sender_user_id, m.kind, m.body, m.reply_to_message_id, m.created_at
  from messages m
  where m.room_id = p_room_id
    and m.deleted_at is null
    and length(trim(p_query)) >= 2
    and m.body ilike '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%' escape '\'
    and (
      m.kind <> 'secret'
      or m.sender_user_id = auth.uid()
      or m.secret_recipient_user_id = auth.uid()
    )
  order by m.created_at desc
  limit least(greatest(p_limit, 1), 100);
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

  insert into stories(room_id, author_user_id, visibility, title, body)
  values (p_room_id, auth.uid(), p_visibility, trim(p_title), trim(p_body))
  returning id into v_story_id;
  return v_story_id;
end;
$$;

grant execute on function public.send_room_message(uuid,public.message_kind,text,uuid,uuid,uuid) to authenticated;
grant execute on function public.search_room_messages(uuid,text,integer) to authenticated;
grant execute on function public.create_story(uuid,public.story_visibility,text,text) to authenticated;
