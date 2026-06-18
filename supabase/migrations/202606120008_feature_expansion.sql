create type public.room_visibility as enum ('public', 'private');
create type public.story_visibility as enum ('room', 'public');
create type public.message_kind as enum ('text', 'image', 'system', 'secret');

alter table public.rooms
  add column if not exists visibility public.room_visibility not null default 'public',
  add column if not exists pin_hash text,
  add column if not exists background_theme_id text not null default 'default';

create table public.room_bans (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  banned_by_user_id uuid not null references public.users(id),
  reason text not null default '' check (char_length(reason) <= 300),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.users(id),
  primary key (room_id, user_id)
);

create table public.room_audit_logs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  actor_user_id uuid not null references public.users(id),
  target_user_id uuid references public.users(id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.room_pin_grants (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  primary key (room_id, user_id)
);

create table public.room_user_preferences (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pinned boolean not null default false,
  pin_order integer,
  notifications_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete set null,
  kind public.message_kind not null,
  body text not null default '' check (char_length(body) <= 2000),
  reply_to_message_id uuid references public.messages(id) on delete set null,
  secret_recipient_user_id uuid references public.users(id) on delete set null,
  media_group_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.message_assets (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  position smallint not null check (position between 0 and 4),
  unique (message_id, position)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  visibility public.story_visibility not null default 'room',
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  push_token text not null unique,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index room_bans_active on public.room_bans(room_id, user_id)
  where revoked_at is null;
create index room_audit_logs_room_time on public.room_audit_logs(room_id, created_at desc);
create index messages_room_time on public.messages(room_id, created_at desc, id desc)
  where deleted_at is null;
create index messages_reply on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;
create index stories_public_recent on public.stories(created_at desc)
  where visibility = 'public' and deleted_at is null;
create index room_preferences_user on public.room_user_preferences(user_id, pinned desc, pin_order, updated_at desc);
create index push_devices_user_enabled on public.push_devices(user_id) where enabled = true;

alter table public.room_bans enable row level security;
alter table public.room_audit_logs enable row level security;
alter table public.room_pin_grants enable row level security;
alter table public.room_user_preferences enable row level security;
alter table public.messages enable row level security;
alter table public.message_assets enable row level security;
alter table public.stories enable row level security;
alter table public.push_devices enable row level security;

create policy room_bans_read_staff_or_self on public.room_bans
  for select using (user_id = auth.uid() or public.is_room_staff(room_id));
create policy room_audit_logs_read_staff on public.room_audit_logs
  for select using (public.is_room_staff(room_id));
create policy room_pin_grants_read_self on public.room_pin_grants
  for select using (user_id = auth.uid());
create policy room_preferences_read_self on public.room_user_preferences
  for select using (user_id = auth.uid());
create policy messages_read_members on public.messages
  for select using (
    public.is_active_room_member(room_id)
    and (
      kind <> 'secret'
      or sender_user_id = auth.uid()
      or secret_recipient_user_id = auth.uid()
    )
  );
create policy message_assets_read_message_viewers on public.message_assets
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_assets.message_id
        and public.is_active_room_member(m.room_id)
        and (
          m.kind <> 'secret'
          or m.sender_user_id = auth.uid()
          or m.secret_recipient_user_id = auth.uid()
        )
    )
  );
create policy stories_read_by_visibility on public.stories
  for select using (
    deleted_at is null
    and (
      (visibility = 'room' and public.is_active_room_member(room_id))
      or (
        visibility = 'public'
        and exists (
          select 1 from public.rooms r
          where r.id = stories.room_id
            and r.visibility = 'public'
            and r.category <> 'adult'
            and r.deleted_at is null
            and r.moderation_status = 'active'
        )
      )
    )
  );
create policy push_devices_read_self on public.push_devices
  for select using (user_id = auth.uid());

drop policy if exists rooms_age_gated_read on public.rooms;
create policy rooms_visibility_and_age_read on public.rooms
  for select using (
    deleted_at is null
    and moderation_status = 'active'
    and (
      visibility = 'public'
      or public.is_active_room_member(id)
      or exists (
        select 1 from public.room_pin_grants grant_row
        where grant_row.room_id = rooms.id
          and grant_row.user_id = auth.uid()
          and grant_row.expires_at > now()
      )
    )
    and (
      category <> 'adult'
      or exists (
        select 1 from public.users viewer
        where viewer.id = auth.uid()
          and viewer.adult_verified_at is not null
      )
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
  if exists (
    select 1 from rooms
    where owner_user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'ROOM_CREATE_COOLDOWN'; end if;
  if p_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;

  insert into rooms(owner_user_id, name, description, category, max_members, region)
  values (v_user_id, trim(p_name), trim(p_description), p_category, p_max_members, nullif(trim(p_region), ''))
  returning id into v_room_id;

  insert into room_memberships(room_id, user_id, role, status, joined_at)
  values (v_room_id, v_user_id, 'owner', 'active', now());
  insert into room_user_preferences(room_id, user_id)
  values (v_room_id, v_user_id);
  return v_room_id;
end;
$$;

create or replace function public.configure_room_access(
  p_room_id uuid,
  p_visibility public.room_visibility,
  p_pin text default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;
  if p_pin is not null and p_pin !~ '^[0-9]{6}$' then raise exception 'INVALID_PIN'; end if;

  update rooms
  set visibility = p_visibility,
      pin_hash = case when p_pin is null or p_pin = '' then null else crypt(p_pin, gen_salt('bf')) end,
      updated_at = now()
  where id = p_room_id;
end;
$$;

create or replace function public.verify_room_pin(p_room_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pin !~ '^[0-9]{6}$' then return false; end if;
  select pin_hash into v_hash from rooms
  where id = p_room_id and visibility = 'private' and deleted_at is null;
  if v_hash is null or crypt(p_pin, v_hash) <> v_hash then return false; end if;
  insert into room_pin_grants(room_id, user_id, granted_at, expires_at)
  values (p_room_id, auth.uid(), now(), now() + interval '30 minutes')
  on conflict (room_id, user_id) do update
    set granted_at = now(), expires_at = excluded.expires_at;
  return true;
end;
$$;

create or replace function public.kick_or_ban_room_member(
  p_room_id uuid,
  p_target_user_id uuid,
  p_ban boolean,
  p_reason text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
begin
  select role into v_actor_role from room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role from room_memberships
  where room_id = p_room_id and user_id = p_target_user_id;
  if v_target_role = 'owner' then raise exception 'CANNOT_REMOVE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  update room_memberships
  set status = 'kicked', left_at = now(), updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id;

  if p_ban then
    insert into room_bans(room_id, user_id, banned_by_user_id, reason, created_at, revoked_at, revoked_by_user_id)
    values (p_room_id, p_target_user_id, auth.uid(), trim(p_reason), now(), null, null)
    on conflict (room_id, user_id) do update
      set banned_by_user_id = auth.uid(),
          reason = excluded.reason,
          created_at = now(),
          expires_at = null,
          revoked_at = null,
          revoked_by_user_id = null;
  end if;

  insert into room_audit_logs(room_id, actor_user_id, target_user_id, action, metadata)
  values (
    p_room_id,
    auth.uid(),
    p_target_user_id,
    case when p_ban then 'member_banned' else 'member_kicked' end,
    jsonb_build_object('reason', trim(p_reason))
  );
end;
$$;

create or replace function public.unban_room_member(p_room_id uuid, p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;

  update room_bans
  set revoked_at = now(), revoked_by_user_id = auth.uid()
  where room_id = p_room_id
    and user_id = p_target_user_id
    and revoked_at is null;

  insert into room_audit_logs(room_id, actor_user_id, target_user_id, action)
  values (p_room_id, auth.uid(), p_target_user_id, 'member_unbanned');
end;
$$;

create or replace function public.set_room_pin_preference(
  p_room_id uuid,
  p_pinned boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  insert into room_user_preferences(room_id, user_id, pinned, pin_order, updated_at)
  values (p_room_id, auth.uid(), p_pinned, case when p_pinned then 0 else null end, now())
  on conflict (room_id, user_id) do update
    set pinned = excluded.pinned,
        pin_order = excluded.pin_order,
        updated_at = now();
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
  v_category public.room_category;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (
    select 1 from room_bans
    where room_id = p_room_id
      and user_id = v_user_id
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  ) then raise exception 'ROOM_BANNED'; end if;

  select category into v_category
  from rooms
  where id = p_room_id
    and deleted_at is null
    and moderation_status = 'active';
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_category = 'adult' and not exists (
    select 1 from users where id = v_user_id and adult_verified_at is not null
  ) then raise exception 'ADULT_VERIFICATION_REQUIRED'; end if;
  if exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = v_user_id and status = 'active'
  ) then raise exception 'ALREADY_MEMBER'; end if;
  if exists (
    select 1 from room_join_requests
    where room_id = p_room_id and user_id = v_user_id
      and created_at > now() - interval '1 minute'
  ) then raise exception 'RATE_LIMITED'; end if;

  insert into room_join_requests(room_id, user_id, requested_name, requested_introduction)
  values (p_room_id, v_user_id, trim(p_name), trim(p_introduction));
end;
$$;

grant execute on function public.configure_room_access(uuid,public.room_visibility,text) to authenticated;
grant execute on function public.verify_room_pin(uuid,text) to authenticated;
grant execute on function public.kick_or_ban_room_member(uuid,uuid,boolean,text) to authenticated;
grant execute on function public.unban_room_member(uuid,uuid) to authenticated;
grant execute on function public.set_room_pin_preference(uuid,boolean) to authenticated;
