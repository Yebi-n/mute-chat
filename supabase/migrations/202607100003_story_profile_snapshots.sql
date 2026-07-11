alter table public.stories
  add column if not exists author_name text,
  add column if not exists author_avatar_asset_path text;

alter table public.story_comments
  add column if not exists author_name text,
  add column if not exists author_avatar_asset_path text;

update public.stories s
set
  author_name = coalesce(s.author_name, nullif(trim(rp.display_name), ''), '멤버'),
  author_avatar_asset_path = coalesce(s.author_avatar_asset_path, rp.avatar_asset_path)
from public.room_profiles rp
where rp.room_id = s.room_id
  and rp.user_id = s.author_user_id
  and (s.author_name is null or s.author_avatar_asset_path is null);

update public.story_comments c
set
  author_name = coalesce(c.author_name, nullif(trim(rp.display_name), ''), '멤버'),
  author_avatar_asset_path = coalesce(c.author_avatar_asset_path, rp.avatar_asset_path)
from public.stories s, public.room_profiles rp
where s.id = c.story_id
  and rp.room_id = s.room_id
  and rp.user_id = c.author_user_id
  and (c.author_name is null or c.author_avatar_asset_path is null);

create or replace function public.snapshot_story_author_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  select nullif(trim(display_name), ''), avatar_asset_path
    into v_name, v_avatar
  from public.room_profiles
  where room_id = new.room_id
    and user_id = new.author_user_id
  limit 1;

  new.author_name := coalesce(new.author_name, v_name, '멤버');
  new.author_avatar_asset_path := coalesce(new.author_avatar_asset_path, v_avatar);
  return new;
end;
$$;

drop trigger if exists trg_snapshot_story_author_profile on public.stories;
create trigger trg_snapshot_story_author_profile
before insert on public.stories
for each row execute function public.snapshot_story_author_profile();

create or replace function public.snapshot_story_comment_author_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_name text;
  v_avatar text;
begin
  select room_id into v_room_id
  from public.stories
  where id = new.story_id;

  select nullif(trim(display_name), ''), avatar_asset_path
    into v_name, v_avatar
  from public.room_profiles
  where room_id = v_room_id
    and user_id = new.author_user_id
  limit 1;

  new.author_name := coalesce(new.author_name, v_name, '멤버');
  new.author_avatar_asset_path := coalesce(new.author_avatar_asset_path, v_avatar);
  return new;
end;
$$;

drop trigger if exists trg_snapshot_story_comment_author_profile on public.story_comments;
create trigger trg_snapshot_story_comment_author_profile
before insert on public.story_comments
for each row execute function public.snapshot_story_comment_author_profile();
