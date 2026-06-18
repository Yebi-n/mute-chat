alter table public.stories
  add column if not exists view_count integer not null default 0,
  add column if not exists heart_count integer not null default 0;

create table if not exists public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

alter table public.story_likes enable row level security;

drop policy if exists story_likes_read_own on public.story_likes;
create policy story_likes_read_own on public.story_likes
for select to authenticated
using (user_id = auth.uid());

create or replace function public.record_story_view(p_story_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update stories
  set view_count = view_count + 1
  where id = p_story_id
    and deleted_at is null
    and visibility = 'public'
  returning view_count into v_count;
  return coalesce(v_count, 0);
end;
$$;

create or replace function public.toggle_story_like(p_story_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_liked boolean;
  v_count integer;
begin
  if exists (
    select 1 from story_likes
    where story_id = p_story_id and user_id = auth.uid()
  ) then
    delete from story_likes
    where story_id = p_story_id and user_id = auth.uid();
    v_liked := false;
  else
    insert into story_likes(story_id, user_id)
    values (p_story_id, auth.uid());
    v_liked := true;
  end if;

  select count(*)::integer into v_count
  from story_likes
  where story_id = p_story_id;

  update stories set heart_count = v_count where id = p_story_id;
  return jsonb_build_object('liked', v_liked, 'heartCount', v_count);
end;
$$;

revoke all on function public.record_story_view(uuid) from public;
revoke all on function public.toggle_story_like(uuid) from public;
grant execute on function public.record_story_view(uuid) to authenticated;
grant execute on function public.toggle_story_like(uuid) to authenticated;
