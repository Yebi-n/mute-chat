create type public.moderation_status as enum ('active', 'limited', 'under_review', 'removed');
create type public.report_target_type as enum ('room', 'user', 'message', 'story', 'comment');
create type public.report_reason as enum (
  'sexual_content',
  'minor_safety',
  'harassment',
  'hate',
  'violence',
  'self_harm',
  'illegal_activity',
  'privacy',
  'spam',
  'impersonation',
  'other'
);

alter table public.rooms
  add column if not exists moderation_status public.moderation_status not null default 'active',
  add column if not exists adult_content_warning boolean not null default false;

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('terms', 'privacy', 'community', 'adult')),
  version text not null,
  published_at timestamptz not null default now(),
  url text not null,
  is_current boolean not null default true,
  unique (document_type, version)
);

create table public.user_legal_acceptances (
  user_id uuid not null references public.users(id) on delete cascade,
  legal_document_id uuid not null references public.legal_documents(id),
  accepted_at timestamptz not null default now(),
  primary key (user_id, legal_document_id)
);

create table public.user_blocks (
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.users(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason public.report_reason not null,
  detail text not null default '' check (char_length(detail) <= 1000),
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'triaged', 'actioned', 'dismissed')),
  priority smallint not null default 0 check (priority between 0 and 100),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.account_deletion_requests (
  user_id uuid primary key references public.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '7 days'),
  cancelled_at timestamptz,
  completed_at timestamptz
);

create index reports_review_queue on public.reports(status, priority desc, created_at);
create index reports_target_history on public.reports(target_type, target_id, created_at desc);

alter table public.legal_documents enable row level security;
alter table public.user_legal_acceptances enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.account_deletion_requests enable row level security;

drop policy if exists rooms_public_read on public.rooms;
create policy rooms_age_gated_read on public.rooms
  for select using (
    deleted_at is null
    and moderation_status = 'active'
    and (
      category <> 'adult'
      or exists (
        select 1 from public.users viewer
        where viewer.id = auth.uid()
          and viewer.adult_verified_at is not null
      )
    )
  );

drop policy if exists room_profiles_public_summary on public.room_profiles;
create policy room_profiles_age_gated_summary on public.room_profiles
  for select using (
    exists (
      select 1
      from public.rooms r
      where r.id = room_profiles.room_id
        and r.deleted_at is null
        and r.moderation_status = 'active'
        and (
          r.category <> 'adult'
          or exists (
            select 1 from public.users viewer
            where viewer.id = auth.uid()
              and viewer.adult_verified_at is not null
          )
        )
    )
  );

create policy legal_documents_public_read on public.legal_documents
  for select using (is_current = true);
create policy legal_acceptances_read_self on public.user_legal_acceptances
  for select using (user_id = auth.uid());
create policy blocks_read_self on public.user_blocks
  for select using (blocker_user_id = auth.uid());
create policy reports_read_self on public.reports
  for select using (reporter_user_id = auth.uid());
create policy deletion_requests_read_self on public.account_deletion_requests
  for select using (user_id = auth.uid());

create or replace function public.request_room_join(
  p_room_id uuid,
  p_name text,
  p_introduction text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_category public.room_category;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select category into v_category
  from rooms
  where id = p_room_id
    and deleted_at is null
    and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;

  if v_category = 'adult' and not exists (
    select 1 from users
    where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id
      and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;

  insert into room_join_requests(room_id, user_id, requested_name, requested_introduction)
  values (p_room_id, v_user_id, trim(p_name), trim(p_introduction));
end;
$$;

create or replace function public.block_user(p_blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into user_blocks(blocker_user_id, blocked_user_id)
  values (auth.uid(), p_blocked_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_blocked_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from user_blocks
  where blocker_user_id = auth.uid()
    and blocked_user_id = p_blocked_user_id;
$$;

create or replace function public.submit_report(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_detail text default ''
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_priority smallint := 10;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (
    select 1 from reports
    where reporter_user_id = v_user_id
      and target_type = p_target_type
      and target_id = p_target_id
      and created_at > now() - interval '5 minutes'
  ) then raise exception 'RATE_LIMITED'; end if;

  if p_reason in ('minor_safety', 'violence', 'self_harm') then
    v_priority := 100;
  elsif p_reason in ('sexual_content', 'illegal_activity', 'privacy') then
    v_priority := 70;
  end if;

  insert into reports(reporter_user_id, target_type, target_id, reason, detail, priority)
  values (v_user_id, p_target_type, p_target_id, p_reason, trim(p_detail), v_priority)
  returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.accept_legal_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from legal_documents
    where id = p_document_id and is_current = true
  ) then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  insert into user_legal_acceptances(user_id, legal_document_id)
  values (auth.uid(), p_document_id)
  on conflict do nothing;
end;
$$;

create or replace function public.request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scheduled_for timestamptz := now() + interval '7 days';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into account_deletion_requests(user_id, requested_at, scheduled_for, cancelled_at, completed_at)
  values (auth.uid(), now(), v_scheduled_for, null, null)
  on conflict (user_id) do update
    set requested_at = now(),
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = null;
  return v_scheduled_for;
end;
$$;

create or replace function public.cancel_account_deletion()
returns void
language sql
security definer
set search_path = public
as $$
  update account_deletion_requests
  set cancelled_at = now()
  where user_id = auth.uid()
    and completed_at is null;
$$;

grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.submit_report(public.report_target_type,uuid,public.report_reason,text) to authenticated;
grant execute on function public.accept_legal_document(uuid) to authenticated;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
