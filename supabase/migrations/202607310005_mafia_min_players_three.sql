-- Allow mafia games to start from 3 players and keep mid-game room joins safe.

do $$
declare
  v_constraint_name text;
begin
  for v_constraint_name in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and check_clause like '%selected_capacity%'
      and check_clause like '%mafia_games%'
  loop
    execute format('alter table public.mafia_games drop constraint if exists %I', v_constraint_name);
  end loop;

  -- Fallback for the original generated constraint name.
  alter table public.mafia_games drop constraint if exists mafia_games_selected_capacity_check;
exception
  when undefined_table then
    null;
end $$;

alter table public.mafia_games
  alter column min_players set default 3,
  add constraint mafia_games_selected_capacity_check
    check (selected_capacity between 3 and 20);

update public.mafia_games
set min_players = 3
where status = 'waiting'
  and phase = 'lobby'
  and min_players > 3;

create or replace function public.mafia_role_plan(p_count integer)
returns table(role public.mafia_role, amount integer)
language sql
stable
as $$
  select 'mafia'::public.mafia_role,
    case
      when p_count < 3 then 0
      when p_count >= 16 then 4
      when p_count >= 11 then 3
      when p_count >= 7 then 2
      else 1
    end
  union all select 'police'::public.mafia_role, case when p_count >= 3 then 1 else 0 end
  union all select 'doctor'::public.mafia_role, case when p_count >= 3 then 1 else 0 end
  union all select 'lover'::public.mafia_role, case when p_count >= 9 then 2 else 0 end
  union all select 'citizen'::public.mafia_role,
    greatest(
      0,
      p_count
      - (case
          when p_count < 3 then 0
          when p_count >= 16 then 4
          when p_count >= 11 then 3
          when p_count >= 7 then 2
          else 1
        end)
      - (case when p_count >= 3 then 1 else 0 end)
      - (case when p_count >= 3 then 1 else 0 end)
      - (case when p_count >= 9 then 2 else 0 end)
    );
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
  v_member_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_member_count
  from public.room_memberships
  where room_id = p_room_id
    and status = 'active'
    and left_at is null;

  if coalesce(v_member_count, 0) < 3 then
    raise exception 'MAFIA_MIN_MEMBERS_REQUIRED';
  end if;
  if p_capacity < 3 or p_capacity > least(20, v_member_count) then
    raise exception 'INVALID_CAPACITY';
  end if;

  select display_name, avatar_asset_path
  into v_name, v_avatar
  from public.mafia_player_snapshot(p_room_id, auth.uid());

  insert into public.mafia_games(room_id, host_user_id, selected_capacity, min_players)
  values (p_room_id, auth.uid(), p_capacity, 3)
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

create or replace function public.mafia_start_now(p_game_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game
  from public.mafia_games
  where id = p_game_id
  for update;

  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.status <> 'waiting' or v_game.phase <> 'lobby' then raise exception 'GAME_NOT_WAITING'; end if;
  if not public.is_active_room_member(v_game.room_id) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1
    from public.mafia_players
    where game_id = p_game_id
      and user_id = auth.uid()
      and left_at is null
  ) and auth.uid() <> v_game.host_user_id and not public.is_room_staff(v_game.room_id) then
    raise exception 'FORBIDDEN';
  end if;

  -- Keep the participant set frozen at game start. Members who join the room
  -- after this point are spectators and are not assigned roles/actions.
  select count(*) into v_count
  from public.mafia_players
  where game_id = p_game_id
    and left_at is null;

  if coalesce(v_count, 0) < greatest(3, coalesce(v_game.min_players, 3)) then
    raise exception 'MAFIA_MIN_PLAYERS_REQUIRED';
  end if;

  perform public.mafia_assign_roles(p_game_id);

  update public.mafia_games
  set status = 'running',
      phase = 'night',
      phase_started_at = now(),
      phase_ends_at = now() + interval '60 seconds',
      day_number = 1,
      min_players = 3
  where id = p_game_id;

  perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_NIGHT_START] day=1');

  return public.mafia_get_state(v_game.room_id);
end;
$$;

grant execute on function public.mafia_role_plan(integer) to authenticated;
grant execute on function public.mafia_start_lobby(uuid, integer) to authenticated;
grant execute on function public.mafia_start_now(uuid) to authenticated;
