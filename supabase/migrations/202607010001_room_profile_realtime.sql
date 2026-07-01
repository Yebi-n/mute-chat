do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_profiles'
  ) then
    alter publication supabase_realtime add table public.room_profiles;
  end if;
end
$$;

create or replace function public.freeze_departing_member_message_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  if tg_op = 'UPDATE' and not (
    old.status = 'active' and new.status is distinct from 'active'
  ) then
    return new;
  end if;

  select nullif(trim(display_name), ''), avatar_asset_path
  into v_name, v_avatar
  from public.room_profiles
  where room_id = old.room_id
    and user_id = old.user_id;

  if v_name is not null or v_avatar is not null then
    update public.messages
    set sender_display_name_snapshot = coalesce(v_name, sender_display_name_snapshot),
        sender_avatar_asset_path_snapshot = coalesce(v_avatar, sender_avatar_asset_path_snapshot)
    where room_id = old.room_id
      and sender_user_id = old.user_id
      and (
        sender_display_name_snapshot is distinct from coalesce(v_name, sender_display_name_snapshot)
        or sender_avatar_asset_path_snapshot is distinct from coalesce(v_avatar, sender_avatar_asset_path_snapshot)
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists freeze_departing_member_message_profile_trigger
on public.room_memberships;

create trigger freeze_departing_member_message_profile_trigger
before update of status or delete on public.room_memberships
for each row
execute function public.freeze_departing_member_message_profile();
