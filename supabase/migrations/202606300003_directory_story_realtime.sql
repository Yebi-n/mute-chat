do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_memberships'
  ) then
    alter publication supabase_realtime add table public.room_memberships;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stories'
  ) then
    alter publication supabase_realtime add table public.stories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'story_comments'
  ) then
    alter publication supabase_realtime add table public.story_comments;
  end if;
end $$;
