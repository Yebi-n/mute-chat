alter table public.messages
  add column if not exists story_id uuid references public.stories(id) on delete set null;

create index if not exists messages_story_id_idx
  on public.messages(story_id)
  where story_id is not null;

create or replace function public.announce_story_created(
  p_story_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_story public.stories%rowtype;
  v_message_id uuid;
  v_author_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_story
  from public.stories
  where id = p_story_id
    and deleted_at is null;

  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if v_story.author_user_id <> auth.uid() then raise exception 'FORBIDDEN'; end if;
  if not public.is_active_room_member(v_story.room_id) then raise exception 'FORBIDDEN'; end if;

  select id into v_message_id
  from public.messages
  where story_id = p_story_id
    and deleted_at is null
  limit 1;

  if v_message_id is not null then
    return v_message_id;
  end if;

  select coalesce(nullif(trim(display_name), ''), '멤버')
    into v_author_name
  from public.room_profiles
  where room_id = v_story.room_id
    and user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body, story_id)
  values (
    v_story.room_id,
    auth.uid(),
    'system',
    coalesce(v_author_name, '멤버') || '님이 스토리를 올렸습니다.',
    p_story_id
  )
  returning id into v_message_id;

  update public.rooms set updated_at = now() where id = v_story.room_id;
  return v_message_id;
end;
$$;

revoke all on function public.announce_story_created(uuid) from public;
grant execute on function public.announce_story_created(uuid) to authenticated;
