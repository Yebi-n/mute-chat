do $$
begin
  alter publication supabase_realtime add table public.user_entitlements;
exception
  when duplicate_object then null;
end
$$;
