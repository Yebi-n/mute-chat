do $$
begin
  alter publication supabase_realtime add table public.mafia_players;
exception
  when duplicate_object then null;
end $$;
