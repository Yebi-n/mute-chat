-- Read-only production capacity snapshot for the Supabase SQL editor.

select now() as captured_at,
       current_database() as database_name,
       pg_size_pretty(pg_database_size(current_database())) as database_size;

select relname as table_name,
       n_live_tup as estimated_rows,
       n_dead_tup as dead_rows,
       last_autovacuum,
       last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
order by n_live_tup desc
limit 30;

select relname as table_name,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
       pg_size_pretty(pg_relation_size(relid)) as table_size,
       pg_size_pretty(pg_indexes_size(relid)) as index_size
from pg_catalog.pg_statio_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc
limit 30;

select relname as table_name,
       indexrelname as index_name,
       idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc, pg_relation_size(indexrelid) desc
limit 50;

select count(*) filter (
         where sent_at is null and failed_at is null
       ) as push_pending,
       min(created_at) filter (
         where sent_at is null and failed_at is null
       ) as oldest_pending,
       count(*) filter (
         where failed_at is not null and failed_at > now() - interval '24 hours'
       ) as failed_last_24h
from public.push_outbox;

select state,
       count(*) as connection_count
from pg_stat_activity
where datname = current_database()
group by state
order by connection_count desc;

select pid,
       now() - query_start as running_for,
       wait_event_type,
       wait_event,
       left(query, 180) as query_preview
from pg_stat_activity
where datname = current_database()
  and state <> 'idle'
  and pid <> pg_backend_pid()
order by query_start
limit 20;

select date_trunc('hour', created_at) as hour,
       count(*) as messages
from public.messages
where created_at > now() - interval '24 hours'
group by 1
order by 1 desc;

select room_id,
       count(*) as messages_last_hour
from public.messages
where created_at > now() - interval '1 hour'
group by room_id
order by messages_last_hour desc
limit 20;
