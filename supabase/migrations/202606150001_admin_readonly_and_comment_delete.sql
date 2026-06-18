create or replace function public.delete_story_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment story_comments%rowtype;
  v_story stories%rowtype;
begin
  select * into v_comment from story_comments
  where id = p_comment_id and deleted_at is null;
  if not found then raise exception 'COMMENT_NOT_FOUND'; end if;
  select * into v_story from stories where id = v_comment.story_id and deleted_at is null;
  if not found then raise exception 'STORY_NOT_FOUND'; end if;
  if auth.uid() <> v_comment.author_user_id and auth.uid() <> v_story.author_user_id
    then raise exception 'FORBIDDEN'; end if;
  update story_comments set deleted_at = now(), updated_at = now()
  where id = p_comment_id;
end;
$$;

grant execute on function public.delete_story_comment(uuid) to authenticated;

revoke execute on function public.admin_join_room(uuid) from authenticated;

drop policy if exists messages_read_members on public.messages;
create policy messages_read_members_or_admin on public.messages
  for select using (
    public.is_system_admin()
    or (
      public.is_active_room_member(room_id)
      and (
        kind <> 'secret'
        or sender_user_id = auth.uid()
        or secret_recipient_user_id = auth.uid()
      )
    )
  );

drop policy if exists message_assets_read_message_viewers on public.message_assets;
create policy message_assets_read_message_viewers_or_admin on public.message_assets
  for select using (
    exists (
      select 1 from public.messages message
      where message.id = message_assets.message_id
        and (
          public.is_system_admin()
          or (
            public.is_active_room_member(message.room_id)
            and (
              message.kind <> 'secret'
              or message.sender_user_id = auth.uid()
              or message.secret_recipient_user_id = auth.uid()
            )
          )
        )
    )
  );

drop policy if exists stories_read_by_visibility on public.stories;
create policy stories_read_by_visibility_or_admin on public.stories
  for select using (
    deleted_at is null
    and (
      public.is_system_admin()
      or (visibility = 'room' and public.is_active_room_member(room_id))
      or (
        visibility = 'public'
        and exists (
          select 1 from public.rooms room
          where room.id = stories.room_id
            and room.visibility = 'public'
            and room.category <> 'adult'
            and room.deleted_at is null
            and room.moderation_status = 'active'
        )
      )
    )
  );
