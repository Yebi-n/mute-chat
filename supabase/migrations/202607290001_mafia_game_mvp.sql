-- Mafia game MVP for room chat.
-- Design rules:
-- - No revote. Missing day votes are abstain/no-op.
-- - Missing night actions from mafia/police/doctor are no-op.
-- - All state transitions are server-side so older clients do not corrupt game flow.

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_game_status') then
    create type public.mafia_game_status as enum ('waiting', 'running', 'ended', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_game_phase') then
    create type public.mafia_game_phase as enum (
      'lobby',
      'day_discussion',
      'day_vote',
      'final_defense',
      'final_vote',
      'night',
      'ended'
    );
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_role') then
    create type public.mafia_role as enum ('mafia', 'police', 'doctor', 'lover', 'citizen');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_team') then
    create type public.mafia_team as enum ('mafia', 'citizen');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_action_type') then
    create type public.mafia_action_type as enum ('kill', 'save', 'inspect');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_vote_type') then
    create type public.mafia_vote_type as enum ('execute', 'approve', 'reject');
  end if;
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'mafia_message_visibility') then
    create type public.mafia_message_visibility as enum ('public', 'private', 'spectator', 'mafia', 'lover');
  end if;
end $$;

create table if not exists public.mafia_games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  host_user_id uuid not null references public.users(id) on delete cascade,
  status public.mafia_game_status not null default 'waiting',
  phase public.mafia_game_phase not null default 'lobby',
  day_number integer not null default 1,
  selected_capacity integer not null check (selected_capacity between 5 and 20),
  min_players integer not null default 5,
  phase_started_at timestamptz not null default now(),
  phase_ends_at timestamptz not null default now() + interval '60 seconds',
  defense_target_user_id uuid references public.users(id) on delete set null,
  winner public.mafia_team,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists mafia_games_one_active_room
  on public.mafia_games(room_id)
  where status in ('waiting', 'running');

create table if not exists public.mafia_players (
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  display_name text not null,
  avatar_asset_path text,
  role public.mafia_role,
  team public.mafia_team,
  alive boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  died_at timestamptz,
  death_reason text,
  primary key (game_id, user_id)
);

create table if not exists public.mafia_actions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  day_number integer not null,
  phase public.mafia_game_phase not null,
  actor_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid references public.users(id) on delete set null,
  action_type public.mafia_action_type not null,
  created_at timestamptz not null default now(),
  unique (game_id, day_number, phase, actor_user_id, action_type)
);

create table if not exists public.mafia_votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  day_number integer not null,
  phase public.mafia_game_phase not null,
  voter_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid references public.users(id) on delete set null,
  vote_type public.mafia_vote_type not null,
  created_at timestamptz not null default now(),
  unique (game_id, day_number, phase, voter_user_id)
);

alter table public.messages
  add column if not exists mafia_game_id uuid references public.mafia_games(id) on delete set null,
  add column if not exists mafia_visibility public.mafia_message_visibility not null default 'public',
  add column if not exists mafia_recipient_user_ids uuid[] not null default '{}';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_mafia_game_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_mafia_game_id_fkey
      foreign key (mafia_game_id)
      references public.mafia_games(id)
      on delete set null;
  end if;
end $$;

create index if not exists mafia_games_room_status_idx on public.mafia_games(room_id, status, phase_ends_at);
create index if not exists mafia_players_game_alive_idx on public.mafia_players(game_id, alive);
create index if not exists mafia_actions_game_phase_idx on public.mafia_actions(game_id, day_number, phase);
create index if not exists mafia_votes_game_phase_idx on public.mafia_votes(game_id, day_number, phase);
create index if not exists messages_mafia_game_idx on public.messages(mafia_game_id)
  where mafia_game_id is not null;

alter table public.mafia_games enable row level security;
alter table public.mafia_players enable row level security;
alter table public.mafia_actions enable row level security;
alter table public.mafia_votes enable row level security;

drop policy if exists mafia_games_room_members_read on public.mafia_games;
drop policy if exists mafia_players_room_members_read on public.mafia_players;
drop policy if exists mafia_actions_self_or_spectator_read on public.mafia_actions;
drop policy if exists mafia_votes_room_members_read on public.mafia_votes;

create policy mafia_games_room_members_read on public.mafia_games
  for select to authenticated
  using (public.is_active_room_member(room_id));

create policy mafia_players_room_members_read on public.mafia_players
  for select to authenticated
  using (
    exists (
      select 1
      from public.mafia_games g
      where g.id = game_id and public.is_active_room_member(g.room_id)
    )
  );

create policy mafia_actions_self_or_spectator_read on public.mafia_actions
  for select to authenticated
  using (
    actor_user_id = auth.uid()
    or exists (
      select 1
      from public.mafia_games g
      join public.mafia_players p on p.game_id = g.id and p.user_id = auth.uid()
      where g.id = game_id
        and public.is_active_room_member(g.room_id)
        and (p.alive = false or p.left_at is not null)
    )
  );

create policy mafia_votes_room_members_read on public.mafia_votes
  for select to authenticated
  using (
    exists (
      select 1
      from public.mafia_games g
      where g.id = game_id and public.is_active_room_member(g.room_id)
    )
  );

create or replace function public.mafia_is_message_visible(
  p_room_id uuid,
  p_kind public.message_kind,
  p_sender_user_id uuid,
  p_secret_recipient_user_id uuid,
  p_visibility public.mafia_message_visibility,
  p_recipient_user_ids uuid[],
  p_game_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_system_admin()
    or (
      public.is_active_room_member(p_room_id)
      and (
        p_kind <> 'secret'
        or p_sender_user_id = auth.uid()
        or p_secret_recipient_user_id = auth.uid()
      )
      and (
        p_visibility = 'public'
        or (
          p_game_id is not null
          and (
            (p_visibility = 'private' and auth.uid() = any(p_recipient_user_ids))
            or (
              not exists (
                select 1
                from public.mafia_players mp
                where mp.game_id = p_game_id
                  and mp.user_id = auth.uid()
                  and mp.alive = true
                  and mp.left_at is null
              )
            )
            or (p_visibility in ('mafia','lover') and auth.uid() = any(p_recipient_user_ids))
          )
        )
      )
    );
$$;

drop policy if exists messages_read_members on public.messages;
drop policy if exists messages_read_members_or_admin on public.messages;
drop policy if exists messages_read_members_or_mafia_scope on public.messages;
create policy messages_read_members_or_mafia_scope on public.messages
  for select to authenticated
  using (
    deleted_at is null
    and public.mafia_is_message_visible(
      room_id,
      kind,
      sender_user_id,
      secret_recipient_user_id,
      mafia_visibility,
      mafia_recipient_user_ids,
      mafia_game_id
    )
  );

drop policy if exists message_assets_read_message_viewers on public.message_assets;
drop policy if exists message_assets_read_message_viewers_or_admin on public.message_assets;
drop policy if exists message_assets_read_message_viewers_or_mafia_scope on public.message_assets;
create policy message_assets_read_message_viewers_or_mafia_scope on public.message_assets
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_assets.message_id
        and m.deleted_at is null
        and public.mafia_is_message_visible(
          m.room_id,
          m.kind,
          m.sender_user_id,
          m.secret_recipient_user_id,
          m.mafia_visibility,
          m.mafia_recipient_user_ids,
          m.mafia_game_id
        )
    )
  );

create or replace function public.mafia_role_plan(p_count integer)
returns table(role public.mafia_role, amount integer)
language sql
stable
as $$
  select 'mafia'::public.mafia_role,
    case when p_count >= 16 then 4 when p_count >= 11 then 3 when p_count >= 7 then 2 else 1 end
  union all select 'police'::public.mafia_role, 1
  union all select 'doctor'::public.mafia_role, 1
  union all select 'lover'::public.mafia_role, case when p_count >= 9 then 2 else 0 end
  union all select 'citizen'::public.mafia_role,
    greatest(
      0,
      p_count
      - (case when p_count >= 16 then 4 when p_count >= 11 then 3 when p_count >= 7 then 2 else 1 end)
      - 1
      - 1
      - (case when p_count >= 9 then 2 else 0 end)
    );
$$;

create or replace function public.mafia_post_system_message(
  p_room_id uuid,
  p_game_id uuid,
  p_body text,
  p_visibility public.mafia_message_visibility default 'public',
  p_recipient_user_ids uuid[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.messages(
    room_id,
    sender_user_id,
    kind,
    body,
    mafia_game_id,
    mafia_visibility,
    mafia_recipient_user_ids
  )
  values (p_room_id, null, 'system', p_body, p_game_id, p_visibility, p_recipient_user_ids)
  returning id into v_id;

  update public.rooms set updated_at = now() where id = p_room_id;
  return v_id;
end;
$$;

create or replace function public.mafia_player_snapshot(
  p_room_id uuid,
  p_user_id uuid,
  out display_name text,
  out avatar_asset_path text
) returns record
language plpgsql
security definer
set search_path = public
as $$
begin
  select
    coalesce(nullif(trim(rp.display_name), ''), 'Member'),
    rp.avatar_asset_path
  into display_name, avatar_asset_path
  from public.room_profiles rp
  where rp.room_id = p_room_id and rp.user_id = p_user_id;
end;
$$;

create or replace function public.mafia_start_lobby(
  p_room_id uuid,
  p_capacity integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game_id uuid;
  v_name text;
  v_avatar text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if p_capacity < 5 or p_capacity > 20 then raise exception 'INVALID_CAPACITY'; end if;

  select display_name, avatar_asset_path
  into v_name, v_avatar
  from public.mafia_player_snapshot(p_room_id, auth.uid());

  insert into public.mafia_games(room_id, host_user_id, selected_capacity)
  values (p_room_id, auth.uid(), p_capacity)
  returning id into v_game_id;

  insert into public.mafia_players(game_id, user_id, display_name, avatar_asset_path)
  values (v_game_id, auth.uid(), coalesce(v_name, 'Member'), v_avatar);

  perform public.mafia_post_system_message(
    p_room_id,
    v_game_id,
    format('[MAFIA_LOBBY] capacity=%s seconds=60', p_capacity)
  );

  return public.mafia_get_state(p_room_id);
end;
$$;

create or replace function public.mafia_join_game(p_game_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_name text;
  v_avatar text;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'waiting' or v_game.phase <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;
  if not public.is_active_room_member(v_game.room_id) then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_count
  from public.mafia_players
  where game_id = p_game_id and left_at is null;

  if v_count >= v_game.selected_capacity
     and not exists (
       select 1 from public.mafia_players
       where game_id = p_game_id and user_id = auth.uid() and left_at is not null
     )
  then
    raise exception 'GAME_FULL';
  end if;

  select display_name, avatar_asset_path
  into v_name, v_avatar
  from public.mafia_player_snapshot(v_game.room_id, auth.uid());

  insert into public.mafia_players(game_id, user_id, display_name, avatar_asset_path)
  values (p_game_id, auth.uid(), coalesce(v_name, 'Member'), v_avatar)
  on conflict (game_id, user_id) do update
  set left_at = null,
      alive = true,
      display_name = excluded.display_name,
      avatar_asset_path = excluded.avatar_asset_path,
      role = null,
      team = null;

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_cancel_join(p_game_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'waiting' or v_game.phase <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;

  update public.mafia_players
  set left_at = now()
  where game_id = p_game_id and user_id = auth.uid();

  select display_name into v_name
  from public.mafia_players
  where game_id = p_game_id and user_id = auth.uid();

  perform public.mafia_post_system_message(
    v_game.room_id,
    p_game_id,
    format('[MAFIA_CANCEL_JOIN] user=%s', coalesce(v_name, 'Member'))
  );

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_assign_roles(p_game_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_roles public.mafia_role[] := '{}';
  v_role public.mafia_role;
  v_amount integer;
  v_player record;
  v_index integer := 1;
begin
  select count(*) into v_count
  from public.mafia_players
  where game_id = p_game_id and left_at is null;

  for v_role, v_amount in select * from public.mafia_role_plan(v_count) loop
    if v_amount > 0 then
      for v_index in 1..v_amount loop
        v_roles := array_append(v_roles, v_role);
      end loop;
    end if;
  end loop;

  v_index := 1;
  for v_player in
    select user_id
    from public.mafia_players
    where game_id = p_game_id and left_at is null
    order by random()
  loop
    update public.mafia_players
    set role = v_roles[v_index],
        team = case when v_roles[v_index] = 'mafia' then 'mafia'::public.mafia_team else 'citizen'::public.mafia_team end,
        alive = true,
        died_at = null,
        death_reason = null
    where game_id = p_game_id and user_id = v_player.user_id;
    v_index := v_index + 1;
  end loop;
end;
$$;

create or replace function public.mafia_check_winner(p_game_id uuid)
returns public.mafia_team
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mafia integer;
  v_citizen integer;
begin
  select
    count(*) filter (where team = 'mafia' and alive and left_at is null),
    count(*) filter (where team = 'citizen' and alive and left_at is null)
  into v_mafia, v_citizen
  from public.mafia_players
  where game_id = p_game_id;

  if coalesce(v_mafia, 0) <= 0 then return 'citizen'; end if;
  if coalesce(v_mafia, 0) >= coalesce(v_citizen, 0) then return 'mafia'; end if;
  return null;
end;
$$;

create or replace function public.mafia_finish_if_winner(p_game_id uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner public.mafia_team;
  v_room_id uuid;
begin
  v_winner := public.mafia_check_winner(p_game_id);
  if v_winner is null then return false; end if;

  update public.mafia_games
  set status = 'ended',
      phase = 'ended',
      winner = v_winner,
      ended_at = now(),
      phase_ends_at = now()
  where id = p_game_id
  returning room_id into v_room_id;

  perform public.mafia_post_system_message(
    v_room_id,
    p_game_id,
    format('[MAFIA_GAME_END] winner=%s', v_winner)
  );
  return true;
end;
$$;

create or replace function public.mafia_kill_lover_partner(
  p_game_id uuid,
  p_dead_user_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.mafia_players
    where game_id = p_game_id
      and user_id = p_dead_user_id
      and role = 'lover'
  ) then
    update public.mafia_players
    set alive = false,
        died_at = coalesce(died_at, now()),
        death_reason = coalesce(death_reason, p_reason)
    where game_id = p_game_id
      and role = 'lover'
      and user_id <> p_dead_user_id
      and alive
      and left_at is null;
  end if;
end;
$$;

create or replace function public.mafia_tick(p_game_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_count integer;
  v_living_count integer;
  v_target uuid;
  v_target_name text;
  v_approve integer;
  v_reject integer;
  v_kill uuid;
  v_save uuid;
  v_room_id uuid;
  v_role public.mafia_role;
begin
  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if not public.is_active_room_member(v_game.room_id) then raise exception 'FORBIDDEN'; end if;

  update public.mafia_players mp
  set left_at = coalesce(mp.left_at, now()),
      alive = false,
      died_at = coalesce(mp.died_at, now()),
      death_reason = coalesce(mp.death_reason, 'left_room')
  where mp.game_id = p_game_id
    and mp.left_at is null
    and not exists (
      select 1
      from public.room_memberships rm
      where rm.room_id = v_game.room_id
        and rm.user_id = mp.user_id
        and rm.status = 'active'
        and rm.left_at is null
    );

  if v_game.status = 'running' and public.mafia_finish_if_winner(p_game_id) then
    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.status in ('ended','cancelled') or now() < v_game.phase_ends_at then
    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'lobby' then
    select count(*) into v_count from public.mafia_players where game_id = p_game_id and left_at is null;

    if v_count < v_game.min_players then
      update public.mafia_games
      set status = 'cancelled', phase = 'ended', ended_at = now(), phase_ends_at = now()
      where id = p_game_id;
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_CANCELLED] reason=not_enough_players');
    else
      perform public.mafia_assign_roles(p_game_id);
      update public.mafia_games
      set status = 'running',
          phase = 'day_discussion',
          phase_started_at = now(),
          phase_ends_at = now() + interval '60 seconds',
          day_number = 1
      where id = p_game_id;
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_DAY_START] day=1');
    end if;

    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'day_discussion' then
    update public.mafia_games
    set phase = 'day_vote',
        phase_started_at = now(),
        phase_ends_at = now() + interval '15 seconds',
        defense_target_user_id = null
    where id = p_game_id;
    perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_DAY_VOTE_START] seconds=15');
    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'day_vote' then
    select count(*) into v_living_count
    from public.mafia_players
    where game_id = p_game_id and alive and left_at is null;

    with vote_counts as (
      select target_user_id, count(*) as votes
      from public.mafia_votes
      where game_id = p_game_id
        and day_number = v_game.day_number
        and phase = 'day_vote'
        and vote_type = 'execute'
        and target_user_id is not null
      group by target_user_id
    ),
    max_vote as (
      select max(votes) as votes from vote_counts
    )
    select vc.target_user_id into v_target
    from vote_counts vc, max_vote mv
    where vc.votes = mv.votes
      and (select count(*) from vote_counts where votes = mv.votes) = 1
      and vc.votes > 0
    limit 1;

    if v_target is null then
      update public.mafia_games
      set phase = 'night',
          phase_started_at = now(),
          phase_ends_at = now() + interval '60 seconds'
      where id = p_game_id;
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_NO_EXECUTION] reason=no_vote_or_tie');
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, format('[MAFIA_NIGHT_START] day=%s', v_game.day_number));
    else
      select display_name into v_target_name
      from public.mafia_players
      where game_id = p_game_id and user_id = v_target;

      update public.mafia_games
      set phase = 'final_defense',
          defense_target_user_id = v_target,
          phase_started_at = now(),
          phase_ends_at = now() + interval '15 seconds'
      where id = p_game_id;
      perform public.mafia_post_system_message(
        v_game.room_id,
        p_game_id,
        format('[MAFIA_FINAL_DEFENSE] userId=%s name=%s seconds=15', v_target, coalesce(v_target_name, 'Member'))
      );
    end if;

    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'final_defense' then
    update public.mafia_games
    set phase = 'final_vote',
        phase_started_at = now(),
        phase_ends_at = now() + interval '15 seconds'
    where id = p_game_id;
    perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_FINAL_VOTE_START] seconds=15');
    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'final_vote' then
    select count(*) into v_living_count
    from public.mafia_players
    where game_id = p_game_id and alive and left_at is null;

    select
      count(*) filter (where vote_type = 'approve'),
      count(*) filter (where vote_type = 'reject')
    into v_approve, v_reject
    from public.mafia_votes
    where game_id = p_game_id
      and day_number = v_game.day_number
      and phase = 'final_vote';

    if coalesce(v_approve, 0) > v_living_count / 2 then
      select display_name, role into v_target_name, v_role
      from public.mafia_players
      where game_id = p_game_id and user_id = v_game.defense_target_user_id;

      update public.mafia_players
      set alive = false,
          died_at = now(),
          death_reason = 'vote'
      where game_id = p_game_id
        and user_id = v_game.defense_target_user_id
        and alive
        and left_at is null;

      perform public.mafia_kill_lover_partner(p_game_id, v_game.defense_target_user_id, 'lover');

      perform public.mafia_post_system_message(
        v_game.room_id,
        p_game_id,
        format('[MAFIA_EXECUTED] userId=%s name=%s role=%s', v_game.defense_target_user_id, coalesce(v_target_name, 'Member'), coalesce(v_role::text, 'unknown'))
      );

      if public.mafia_finish_if_winner(p_game_id) then
        return public.mafia_get_state(v_game.room_id);
      end if;
    else
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_EXECUTION_REJECTED]');
    end if;

    update public.mafia_games
    set phase = 'night',
        phase_started_at = now(),
        phase_ends_at = now() + interval '60 seconds'
    where id = p_game_id;
    perform public.mafia_post_system_message(v_game.room_id, p_game_id, format('[MAFIA_NIGHT_START] day=%s', v_game.day_number));
    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.phase = 'night' then
    with kill_counts as (
      select target_user_id, count(*) as votes
      from public.mafia_actions
      where game_id = p_game_id
        and day_number = v_game.day_number
        and phase = 'night'
        and action_type = 'kill'
        and target_user_id is not null
      group by target_user_id
      order by count(*) desc, min(created_at)
      limit 1
    )
    select target_user_id into v_kill from kill_counts;

    select target_user_id into v_save
    from public.mafia_actions
    where game_id = p_game_id
      and day_number = v_game.day_number
      and phase = 'night'
      and action_type = 'save'
      and target_user_id is not null
    order by created_at desc
    limit 1;

    insert into public.messages(room_id, sender_user_id, kind, body, mafia_game_id, mafia_visibility, mafia_recipient_user_ids)
    select
      v_game.room_id,
      null,
      'system',
      format(
        '[MAFIA_INSPECT_RESULT] targetUserId=%s targetName=%s isMafia=%s',
        a.target_user_id,
        coalesce(p.display_name, 'Member'),
        case when p.role = 'mafia' then 'true' else 'false' end
      ),
      p_game_id,
      'private',
      array[a.actor_user_id]
    from public.mafia_actions a
    join public.mafia_players p on p.game_id = a.game_id and p.user_id = a.target_user_id
    where a.game_id = p_game_id
      and a.day_number = v_game.day_number
      and a.phase = 'night'
      and a.action_type = 'inspect';

    if v_kill is not null and v_kill is distinct from v_save then
      select display_name into v_target_name
      from public.mafia_players
      where game_id = p_game_id and user_id = v_kill;

      update public.mafia_players
      set alive = false,
          died_at = now(),
          death_reason = 'mafia'
      where game_id = p_game_id
        and user_id = v_kill
        and alive
        and left_at is null;

      perform public.mafia_kill_lover_partner(p_game_id, v_kill, 'lover');
      perform public.mafia_post_system_message(
        v_game.room_id,
        p_game_id,
        format('[MAFIA_NIGHT_KILL] userId=%s name=%s', v_kill, coalesce(v_target_name, 'Member'))
      );

      if public.mafia_finish_if_winner(p_game_id) then
        return public.mafia_get_state(v_game.room_id);
      end if;
    else
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_NIGHT_NO_DEATH]');
    end if;

    update public.mafia_games
    set phase = 'day_discussion',
        day_number = day_number + 1,
        phase_started_at = now(),
        phase_ends_at = now() + interval '60 seconds'
    where id = p_game_id
    returning room_id into v_room_id;

    perform public.mafia_post_system_message(v_room_id, p_game_id, format('[MAFIA_DAY_START] day=%s', v_game.day_number + 1));
    return public.mafia_get_state(v_game.room_id);
  end if;

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_vote(
  p_game_id uuid,
  p_target_user_id uuid,
  p_vote_type public.mafia_vote_type
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'running' then raise exception 'GAME_NOT_RUNNING'; end if;
  if not exists (
    select 1
    from public.mafia_players
    where game_id = p_game_id and user_id = auth.uid() and alive and left_at is null
  ) then
    raise exception 'NOT_ALIVE_PLAYER';
  end if;
  if v_game.phase = 'day_vote' and p_vote_type <> 'execute' then raise exception 'INVALID_VOTE'; end if;
  if v_game.phase = 'final_vote' and p_vote_type not in ('approve','reject') then raise exception 'INVALID_VOTE'; end if;
  if v_game.phase not in ('day_vote','final_vote') then raise exception 'NOT_VOTE_PHASE'; end if;
  if v_game.phase = 'day_vote' and p_target_user_id is null then raise exception 'TARGET_REQUIRED'; end if;

  insert into public.mafia_votes(game_id, day_number, phase, voter_user_id, target_user_id, vote_type)
  values (p_game_id, v_game.day_number, v_game.phase, auth.uid(), p_target_user_id, p_vote_type)
  on conflict (game_id, day_number, phase, voter_user_id) do update
  set target_user_id = excluded.target_user_id,
      vote_type = excluded.vote_type,
      created_at = now();

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_night_action(
  p_game_id uuid,
  p_target_user_id uuid,
  p_action_type public.mafia_action_type
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_role public.mafia_role;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'running' or v_game.phase <> 'night' then
    raise exception 'NOT_NIGHT_PHASE';
  end if;

  select role into v_role
  from public.mafia_players
  where game_id = p_game_id and user_id = auth.uid() and alive and left_at is null;

  if v_role is null then raise exception 'NOT_ALIVE_PLAYER'; end if;
  if (p_action_type = 'kill' and v_role <> 'mafia')
     or (p_action_type = 'save' and v_role <> 'doctor')
     or (p_action_type = 'inspect' and v_role <> 'police') then
    raise exception 'INVALID_ROLE_ACTION';
  end if;
  if p_target_user_id is null then raise exception 'TARGET_REQUIRED'; end if;
  if not exists (
    select 1
    from public.mafia_players
    where game_id = p_game_id and user_id = p_target_user_id and alive and left_at is null
  ) then
    raise exception 'INVALID_TARGET';
  end if;

  insert into public.mafia_actions(game_id, day_number, phase, actor_user_id, target_user_id, action_type)
  values (p_game_id, v_game.day_number, 'night', auth.uid(), p_target_user_id, p_action_type)
  on conflict (game_id, day_number, phase, actor_user_id, action_type) do update
  set target_user_id = excluded.target_user_id,
      created_at = now();

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_extend_phase(
  p_game_id uuid,
  p_delta_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_next timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'running' or v_game.phase <> 'day_discussion' then
    raise exception 'NOT_EXTENDABLE';
  end if;
  if not exists (
    select 1
    from public.mafia_players
    where game_id = p_game_id and user_id = auth.uid() and alive and left_at is null
  ) then
    raise exception 'NOT_ALIVE_PLAYER';
  end if;

  v_next := greatest(
    now() + interval '15 seconds',
    least(v_game.phase_ends_at + make_interval(secs => p_delta_seconds), now() + interval '180 seconds')
  );

  update public.mafia_games set phase_ends_at = v_next where id = p_game_id;
  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_send_scoped_message(
  p_game_id uuid,
  p_body text,
  p_visibility public.mafia_message_visibility
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_me public.mafia_players%rowtype;
  v_recipients uuid[];
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_body is null or char_length(trim(p_body)) = 0 or char_length(p_body) > 2000 then
    raise exception 'INVALID_BODY';
  end if;

  select * into v_game from public.mafia_games where id = p_game_id;
  if not found or v_game.status <> 'running' then raise exception 'GAME_NOT_RUNNING'; end if;
  if not public.is_active_room_member(v_game.room_id) then raise exception 'FORBIDDEN'; end if;

  select * into v_me from public.mafia_players where game_id = p_game_id and user_id = auth.uid();

  if p_visibility = 'spectator' then
    if v_me.user_id is not null and v_me.alive and v_me.left_at is null then
      raise exception 'NOT_SPECTATOR';
    end if;
    select array_agg(user_id) into v_recipients
    from public.mafia_players
    where game_id = p_game_id and (alive = false or left_at is not null);
  elsif p_visibility = 'mafia' then
    if v_game.phase <> 'night' or v_me.role <> 'mafia' or not v_me.alive or v_me.left_at is not null then
      raise exception 'INVALID_SCOPED_CHAT';
    end if;
    select array_agg(user_id) into v_recipients
    from public.mafia_players
    where game_id = p_game_id and role = 'mafia' and alive and left_at is null;
  elsif p_visibility = 'lover' then
    if v_game.phase <> 'night' or v_me.role <> 'lover' or not v_me.alive or v_me.left_at is not null then
      raise exception 'INVALID_SCOPED_CHAT';
    end if;
    select array_agg(user_id) into v_recipients
    from public.mafia_players
    where game_id = p_game_id and role = 'lover' and alive and left_at is null;
  else
    raise exception 'INVALID_VISIBILITY';
  end if;

  insert into public.messages(
    room_id,
    sender_user_id,
    kind,
    body,
    mafia_game_id,
    mafia_visibility,
    mafia_recipient_user_ids
  )
  values (
    v_game.room_id,
    auth.uid(),
    'text',
    p_body,
    p_game_id,
    p_visibility,
    coalesce(v_recipients, '{}')
  )
  returning id into v_id;

  update public.rooms set updated_at = now() where id = v_game.room_id;
  return v_id;
end;
$$;

create or replace function public.mafia_force_end(
  p_game_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game
  from public.mafia_games
  where id = p_game_id
  for update;

  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if not public.is_active_room_member(v_game.room_id) then raise exception 'FORBIDDEN'; end if;
  if v_game.status not in ('waiting', 'running') then
    return public.mafia_get_state(v_game.room_id);
  end if;
  if auth.uid() <> v_game.host_user_id and not public.is_room_staff(v_game.room_id) then
    raise exception 'FORBIDDEN';
  end if;

  select display_name into v_actor_name
  from public.mafia_player_snapshot(v_game.room_id, auth.uid());

  update public.mafia_games
  set status = 'cancelled',
      phase = 'ended',
      ended_at = now(),
      phase_ends_at = now()
  where id = p_game_id;

  perform public.mafia_post_system_message(
    v_game.room_id,
    p_game_id,
    format('[MAFIA_FORCE_ENDED] userId=%s name=%s', auth.uid(), coalesce(v_actor_name, 'Member'))
  );

  return public.mafia_get_state(v_game.room_id);
end;
$$;

create or replace function public.mafia_get_state(p_room_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_me public.mafia_players%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;

  select * into v_game
  from public.mafia_games
  where room_id = p_room_id and status in ('waiting','running')
  order by created_at desc
  limit 1;

  if not found then return null; end if;

  select * into v_me
  from public.mafia_players
  where game_id = v_game.id and user_id = auth.uid();

  return jsonb_build_object(
    'id', v_game.id,
    'roomId', v_game.room_id,
    'hostUserId', v_game.host_user_id,
    'status', v_game.status,
    'phase', v_game.phase,
    'dayNumber', v_game.day_number,
    'capacity', v_game.selected_capacity,
    'endsAt', v_game.phase_ends_at,
    'defenseTargetUserId', v_game.defense_target_user_id,
    'winner', v_game.winner,
    'me', case when v_me.user_id is null then null else jsonb_build_object(
      'userId', v_me.user_id,
      'name', v_me.display_name,
      'role', v_me.role,
      'team', v_me.team,
      'alive', v_me.alive,
      'joined', v_me.left_at is null
    ) end,
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'userId', p.user_id,
        'name', p.display_name,
        'avatarPath', p.avatar_asset_path,
        'role', case
          when v_game.status = 'ended'
            or p.user_id = auth.uid()
            or (v_me.user_id is not null and (v_me.alive = false or v_me.left_at is not null))
          then p.role else null end,
        'team', case
          when v_game.status = 'ended'
            or p.user_id = auth.uid()
            or (v_me.user_id is not null and (v_me.alive = false or v_me.left_at is not null))
          then p.team else null end,
        'alive', p.alive,
        'joined', p.left_at is null
      ) order by p.joined_at), '[]'::jsonb)
      from public.mafia_players p
      where p.game_id = v_game.id
    )
  );
end;
$$;

revoke all on function public.mafia_start_lobby(uuid, integer) from public;
revoke all on function public.mafia_join_game(uuid) from public;
revoke all on function public.mafia_cancel_join(uuid) from public;
revoke all on function public.mafia_tick(uuid) from public;
revoke all on function public.mafia_vote(uuid, uuid, public.mafia_vote_type) from public;
revoke all on function public.mafia_night_action(uuid, uuid, public.mafia_action_type) from public;
revoke all on function public.mafia_extend_phase(uuid, integer) from public;
revoke all on function public.mafia_send_scoped_message(uuid, text, public.mafia_message_visibility) from public;
revoke all on function public.mafia_force_end(uuid) from public;
revoke all on function public.mafia_get_state(uuid) from public;

grant execute on function public.mafia_start_lobby(uuid, integer) to authenticated;
grant execute on function public.mafia_join_game(uuid) to authenticated;
grant execute on function public.mafia_cancel_join(uuid) to authenticated;
grant execute on function public.mafia_tick(uuid) to authenticated;
grant execute on function public.mafia_vote(uuid, uuid, public.mafia_vote_type) to authenticated;
grant execute on function public.mafia_night_action(uuid, uuid, public.mafia_action_type) to authenticated;
grant execute on function public.mafia_extend_phase(uuid, integer) to authenticated;
grant execute on function public.mafia_send_scoped_message(uuid, text, public.mafia_message_visibility) to authenticated;
grant execute on function public.mafia_force_end(uuid) to authenticated;
grant execute on function public.mafia_get_state(uuid) to authenticated;
