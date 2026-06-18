create extension if not exists pgcrypto;

create type public.room_category as enum ('member', 'concept', 'region', 'adult');
create type public.room_role as enum ('owner', 'cohost', 'member');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'left', 'kicked', 'banned');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  adult_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id),
  name text not null check (char_length(name) between 1 and 13),
  description text not null check (char_length(description) between 1 and 120),
  category public.room_category not null,
  region text,
  max_members integer not null check (max_members between 1 and 80),
  cover_asset_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.room_memberships (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role public.room_role not null default 'member',
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table public.room_profiles (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 13),
  introduction text not null default '' check (char_length(introduction) <= 60),
  avatar_asset_path text,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.room_join_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  requested_name text not null check (char_length(requested_name) between 1 and 13),
  requested_introduction text not null check (char_length(requested_introduction) between 1 and 60),
  status public.membership_status not null default 'pending'
    check (status in ('pending', 'active', 'rejected')),
  decided_by_user_id uuid references public.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index room_join_requests_one_pending
  on public.room_join_requests(room_id, user_id)
  where status = 'pending';
create index room_memberships_user_active
  on public.room_memberships(user_id, room_id)
  where status = 'active';
create index room_join_requests_room_pending
  on public.room_join_requests(room_id, created_at)
  where status = 'pending';

alter table public.users enable row level security;
alter table public.rooms enable row level security;
alter table public.room_memberships enable row level security;
alter table public.room_profiles enable row level security;
alter table public.room_join_requests enable row level security;

create policy users_read_self on public.users
  for select using (id = auth.uid());
create policy rooms_public_read on public.rooms
  for select using (deleted_at is null);
create policy memberships_read_related on public.room_memberships
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_memberships viewer
      where viewer.room_id = room_memberships.room_id
        and viewer.user_id = auth.uid()
        and viewer.status = 'active'
    )
  );
create policy room_profiles_public_summary on public.room_profiles
  for select using (
    exists (select 1 from public.rooms r where r.id = room_profiles.room_id and r.deleted_at is null)
  );
create policy join_requests_read_self_or_staff on public.room_join_requests
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_memberships staff
      where staff.room_id = room_join_requests.room_id
        and staff.user_id = auth.uid()
        and staff.status = 'active'
        and staff.role in ('owner', 'cohost')
    )
  );

create or replace function public.create_room(
  p_name text,
  p_description text,
  p_category public.room_category,
  p_max_members integer,
  p_region text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  insert into rooms(owner_user_id, name, description, category, max_members, region)
  values (v_user_id, trim(p_name), trim(p_description), p_category, p_max_members, nullif(trim(p_region), ''))
  returning id into v_room_id;

  insert into room_memberships(room_id, user_id, role, status, joined_at)
  values (v_room_id, v_user_id, 'owner', 'active', now());

  return v_room_id;
end;
$$;

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
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from rooms where id = p_room_id and deleted_at is null)
    then raise exception 'ROOM_NOT_FOUND'; end if;

  insert into room_join_requests(room_id, user_id, requested_name, requested_introduction)
  values (p_room_id, v_user_id, trim(p_name), trim(p_introduction));
end;
$$;

create or replace function public.decide_room_join(
  p_request_id uuid,
  p_approve boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request room_join_requests%rowtype;
  v_active_count integer;
  v_limit integer;
begin
  select * into v_request from room_join_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if not exists (
    select 1 from room_memberships
    where room_id = v_request.room_id
      and user_id = v_user_id
      and status = 'active'
      and role in ('owner', 'cohost')
  ) then raise exception 'FORBIDDEN'; end if;

  if p_approve then
    select count(*), max(r.max_members) into v_active_count, v_limit
    from rooms r
    left join room_memberships m on m.room_id = r.id and m.status = 'active'
    where r.id = v_request.room_id;
    if v_active_count >= v_limit then raise exception 'ROOM_FULL'; end if;

    insert into room_memberships(room_id, user_id, role, status, joined_at)
    values (v_request.room_id, v_request.user_id, 'member', 'active', now())
    on conflict (room_id, user_id) do update
      set status = 'active', role = 'member', joined_at = now(), updated_at = now();
    insert into room_profiles(room_id, user_id, display_name, introduction)
    values (v_request.room_id, v_request.user_id, v_request.requested_name, v_request.requested_introduction)
    on conflict (room_id, user_id) do update
      set display_name = excluded.display_name,
          introduction = excluded.introduction,
          updated_at = now();
  end if;

  update room_join_requests
  set status = case when p_approve then 'active' else 'rejected' end,
      decided_by_user_id = v_user_id,
      decided_at = now()
  where id = p_request_id;
end;
$$;

grant execute on function public.create_room(text,text,public.room_category,integer,text) to authenticated;
grant execute on function public.request_room_join(uuid,text,text) to authenticated;
grant execute on function public.decide_room_join(uuid,boolean) to authenticated;
