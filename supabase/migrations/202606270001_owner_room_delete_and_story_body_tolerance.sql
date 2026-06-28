create or replace function public.delete_room_as_owner(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_system_admin()
    or exists (
      select 1
      from public.room_memberships membership
      where membership.room_id = p_room_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = 'owner'
    )
  ) then
    raise exception 'FORBIDDEN';
  end if;

  update public.rooms
  set deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = p_room_id;

  update public.room_top_spaces
  set expires_at = least(expires_at, now())
  where room_id = p_room_id
    and expires_at > now();

  delete from public.room_promotions
  where room_id = p_room_id;
end;
$$;

revoke all on function public.delete_room_as_owner(uuid) from public;
grant execute on function public.delete_room_as_owner(uuid) to authenticated;

create or replace function public.assert_story_blocks_allowed(p_blocks jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_block jsonb;
  v_text text;
  v_body text := '';
  v_has_content boolean := false;
begin
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then
    raise exception 'INVALID_STORY_BODY';
  end if;

  for v_block in select value from jsonb_array_elements(p_blocks)
  loop
    if v_block ->> 'type' = 'text' then
      v_text := trim(coalesce(v_block ->> 'text', ''));
      if v_text <> '' then
        perform public.assert_text_allowed(v_text, 'story_body');
        v_body := concat_ws(E'\n', nullif(v_body, ''), v_text);
        v_has_content := true;
      end if;
    elsif v_block ->> 'type' = 'image' then
      if coalesce(v_block ->> 'uploadId', '') <> '' then
        v_has_content := true;
      end if;
    else
      raise exception 'INVALID_BLOCK_TYPE';
    end if;
  end loop;

  if not v_has_content then
    raise exception 'INVALID_STORY_BODY';
  end if;

  return coalesce(nullif(v_body, ''), '사진');
end;
$$;

grant execute on function public.assert_story_blocks_allowed(jsonb) to authenticated;
