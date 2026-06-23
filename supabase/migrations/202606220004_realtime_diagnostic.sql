create or replace function public.get_realtime_diagnostics()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'messages_in_publication', exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ),
    'wal_level', current_setting('wal_level', true),
    'rls_enabled', c.relrowsecurity,
    'replica_identity', c.relreplident,
    'select_policies', coalesce((
      select jsonb_agg(pol.polname order by pol.polname)
      from pg_policy pol
      where pol.polrelid = c.oid
        and pol.polcmd in ('r', '*')
    ), '[]'::jsonb)
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'messages';
$$;

revoke all on function public.get_realtime_diagnostics() from public;
grant execute on function public.get_realtime_diagnostics() to authenticated;
