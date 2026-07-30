create table if not exists public.app_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_notices enable row level security;

drop policy if exists app_notices_read_active on public.app_notices;
create policy app_notices_read_active
on public.app_notices
for select
to authenticated
using (
  enabled
  and starts_at <= now()
  and (ends_at is null or ends_at > now())
);

create or replace function public.list_active_app_notices()
returns table (
  id uuid,
  body text,
  priority integer
)
language sql
stable
security definer
set search_path = public
as $$
  select notice.id, notice.body, notice.priority
  from public.app_notices notice
  where notice.enabled
    and notice.starts_at <= now()
    and (notice.ends_at is null or notice.ends_at > now())
    and length(trim(notice.body)) > 0
  order by notice.priority asc, notice.created_at desc;
$$;

revoke all on function public.list_active_app_notices() from public;
grant execute on function public.list_active_app_notices() to authenticated;
