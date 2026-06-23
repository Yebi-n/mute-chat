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

  update stories
  set title = trim(p_title),
      body = v_body,
      visibility = coalesce(p_visibility, visibility),
      updated_at = now()
  where id = p_story_id;

  delete from story_blocks where story_id = p_story_id;
  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      if length(trim(coalesce(v_block ->> 'text', ''))) > 0 then
        insert into story_blocks(story_id, block_type, text_content, position)
        values (p_story_id, 'text', trim(v_block ->> 'text'), v_position);
        v_position := v_position + 1;
      end if;
    elsif coalesce(v_block ->> 'storagePath', '') <> '' then
      insert into story_blocks(story_id, block_type, storage_path, mime_type, position)
      values (
        p_story_id, 'image', v_block ->> 'storagePath',
        coalesce(v_block ->> 'mimeType', 'image/jpeg'), v_position
      );
      v_position := v_position + 1;
    end if;
  end loop;
end;
$$;

revoke all on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) from public;
grant execute on function public.update_story_content_v2(uuid, public.story_visibility, text, jsonb) to authenticated;

create or replace function public.soft_delete_empty_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid := coalesce(new.room_id, old.room_id);
begin
  if v_room_id is not null and not exists (
    select 1 from public.room_memberships
    where room_id = v_room_id
      and status = 'active'
  ) then
    update public.rooms
    set deleted_at = now(), updated_at = now()
    where id = v_room_id
      and deleted_at is null;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_soft_delete_empty_room on public.room_memberships;
create trigger trg_soft_delete_empty_room
after insert or update or delete on public.room_memberships
for each row execute function public.soft_delete_empty_room();

update public.rooms room
set deleted_at = now(), updated_at = now()
where deleted_at is null
  and not exists (
    select 1 from public.room_memberships membership
    where membership.room_id = room.id
      and membership.status = 'active'
  );
