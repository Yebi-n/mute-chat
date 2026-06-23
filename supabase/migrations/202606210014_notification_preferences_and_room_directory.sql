create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists user_notification_preferences_read_self on public.user_notification_preferences;
create policy user_notification_preferences_read_self
on public.user_notification_preferences for select
using (user_id = auth.uid());

create or replace function public.get_global_notifications_enabled()
returns boolean
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce((
    select preference.notifications_enabled
    from public.user_notification_preferences preference
    where preference.user_id = auth.uid()
  ), true);
$$;

create or replace function public.set_global_notifications_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.user_notification_preferences(user_id, notifications_enabled, updated_at)
  values (auth.uid(), p_enabled, now())
  on conflict (user_id) do update
    set notifications_enabled = excluded.notifications_enabled,
        updated_at = now();
  update public.push_devices
  set enabled = p_enabled,
      last_seen_at = now()
  where user_id = auth.uid();
end;
$$;

create or replace function public.get_room_notifications_enabled(p_room_id uuid)
returns boolean
language sql
security invoker
set search_path = public
stable
as $$
  select coalesce((
    select preference.notifications_enabled
    from public.room_user_preferences preference
    where preference.room_id = p_room_id
      and preference.user_id = auth.uid()
  ), true);
$$;

create or replace function public.set_room_notifications_enabled(p_room_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;
  insert into public.room_user_preferences(room_id, user_id, notifications_enabled, updated_at)
  values (p_room_id, auth.uid(), p_enabled, now())
  on conflict (room_id, user_id) do update
    set notifications_enabled = excluded.notifications_enabled,
        updated_at = now();
end;
$$;

create or replace function public.filter_disabled_global_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.user_notification_preferences preference
    where preference.user_id = new.recipient_user_id
      and not preference.notifications_enabled
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists filter_disabled_global_push_trigger on public.push_outbox;
create trigger filter_disabled_global_push_trigger
before insert on public.push_outbox
for each row execute function public.filter_disabled_global_push();

drop policy if exists chat_media_read_public_story on storage.objects;
create policy chat_media_read_public_story
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-media'
  and exists (
    select 1
    from public.story_blocks block
    join public.stories story on story.id = block.story_id
    join public.rooms room on room.id = story.room_id
    where block.storage_path = storage.objects.name
      and story.visibility = 'public'
      and story.deleted_at is null
      and room.deleted_at is null
      and room.moderation_status = 'active'
      and room.category <> 'adult'
  )
);

create or replace function public.get_room_member_counts(p_room_ids uuid[])
returns table(room_id uuid, member_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select membership.room_id, count(*)::bigint
  from public.room_memberships membership
  join public.rooms room on room.id = membership.room_id
  where membership.room_id = any(p_room_ids)
    and membership.status = 'active'
    and room.deleted_at is null
    and room.moderation_status = 'active'
    and (
      public.is_system_admin()
      or room.visibility = 'public'
      or public.is_active_room_member(room.id)
    )
  group by membership.room_id;
$$;

revoke all on function public.get_global_notifications_enabled() from public;
revoke all on function public.set_global_notifications_enabled(boolean) from public;
revoke all on function public.get_room_notifications_enabled(uuid) from public;
revoke all on function public.set_room_notifications_enabled(uuid,boolean) from public;
revoke all on function public.get_room_member_counts(uuid[]) from public;
grant execute on function public.get_global_notifications_enabled() to authenticated;
grant execute on function public.set_global_notifications_enabled(boolean) to authenticated;
grant execute on function public.get_room_notifications_enabled(uuid) to authenticated;
grant execute on function public.set_room_notifications_enabled(uuid,boolean) to authenticated;
grant execute on function public.get_room_member_counts(uuid[]) to authenticated;
