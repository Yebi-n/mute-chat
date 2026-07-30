create table if not exists public.mafia_phase_adjustments (
  game_id uuid not null references public.mafia_games(id) on delete cascade,
  day_number integer not null,
  phase public.mafia_game_phase not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (game_id, day_number, phase, user_id)
);

alter table public.mafia_phase_adjustments enable row level security;

drop policy if exists "mafia phase adjustments visible to active room members" on public.mafia_phase_adjustments;
create policy "mafia phase adjustments visible to active room members"
on public.mafia_phase_adjustments
for select
using (
  exists (
    select 1
    from public.mafia_games game
    where game.id = mafia_phase_adjustments.game_id
      and public.is_active_room_member(game.room_id)
  )
);

create or replace function public.mafia_is_message_visible(
  p_room_id uuid,
  p_kind public.message_kind,
  p_sender_user_id uuid,
  p_secret_recipient_user_id uuid,
  p_mafia_game_id uuid,
  p_mafia_visibility public.mafia_message_visibility,
  p_mafia_recipient_user_ids uuid[]
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_system_admin()
    or (
      public.is_active_room_member(p_room_id)
      and (
        p_kind <> 'secret'::public.message_kind
        or p_sender_user_id = auth.uid()
        or p_secret_recipient_user_id = auth.uid()
      )
      and (
        coalesce(p_mafia_visibility, 'public'::public.mafia_message_visibility) = 'public'::public.mafia_message_visibility
        or (
          p_mafia_game_id is not null
          and (
            (
              p_mafia_visibility = 'private'::public.mafia_message_visibility
              and auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'))
            )
            or (
              p_mafia_visibility = 'spectator'::public.mafia_message_visibility
              and (
                auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'))
                or not exists (
                  select 1
                  from public.mafia_players me
                  where me.game_id = p_mafia_game_id
                    and me.user_id = auth.uid()
                    and me.alive
                    and me.left_at is null
                )
              )
            )
            or (
              p_mafia_visibility = 'mafia'::public.mafia_message_visibility
              and (
                auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'))
                or not exists (
                  select 1
                  from public.mafia_players me
                  where me.game_id = p_mafia_game_id
                    and me.user_id = auth.uid()
                    and me.alive
                    and me.left_at is null
                )
              )
            )
            or (
              p_mafia_visibility = 'lover'::public.mafia_message_visibility
              and (
                auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'))
                or not exists (
                  select 1
                  from public.mafia_players me
                  where me.game_id = p_mafia_game_id
                    and me.user_id = auth.uid()
                    and me.alive
                    and me.left_at is null
                )
              )
            )
          )
        )
      )
    );
$$;

drop policy if exists messages_read_members_or_mafia_scope on public.messages;
create policy messages_read_members_or_mafia_scope on public.messages
for select
using (
  deleted_at is null
  and public.mafia_is_message_visible(
    room_id,
    kind,
    sender_user_id,
    secret_recipient_user_id,
    mafia_game_id,
    mafia_visibility,
    mafia_recipient_user_ids
  )
);

drop policy if exists message_assets_read_message_viewers_or_mafia_scope on public.message_assets;
create policy message_assets_read_message_viewers_or_mafia_scope on public.message_assets
for select
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
        m.mafia_game_id,
        m.mafia_visibility,
        m.mafia_recipient_user_ids
      )
  )
);

drop function if exists public.mafia_is_message_visible(
  uuid,
  public.message_kind,
  uuid,
  uuid,
  public.mafia_message_visibility,
  uuid[],
  uuid
);

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

  if coalesce(p_visibility, 'public'::public.mafia_message_visibility) = 'public'::public.mafia_message_visibility then
    update public.rooms set updated_at = now() where id = p_room_id;
  end if;

  return v_id;
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
  v_member_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;

  select count(*) into v_member_count
  from public.room_memberships
  where room_id = p_room_id
    and status = 'active'
    and left_at is null;

  if coalesce(v_member_count, 0) < 5 then raise exception 'MAFIA_MIN_MEMBERS_REQUIRED'; end if;
  if p_capacity < 5 or p_capacity > least(20, v_member_count) then raise exception 'INVALID_CAPACITY'; end if;

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

  select count(*) into v_count
  from public.mafia_players
  where game_id = p_game_id
    and left_at is null;

  if coalesce(v_count, 0) < v_game.min_players then
    raise exception 'MAFIA_MIN_PLAYERS_REQUIRED';
  end if;

  perform public.mafia_assign_roles(p_game_id);

  update public.mafia_games
  set status = 'running',
      phase = 'night',
      phase_started_at = now(),
      phase_ends_at = now() + interval '60 seconds',
      day_number = 1
  where id = p_game_id;

  perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_NIGHT_START] day=1');

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
  v_target_name text;
  v_is_mafia boolean;
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

  if p_action_type = 'inspect' then
    select display_name, role = 'mafia'
    into v_target_name, v_is_mafia
    from public.mafia_players
    where game_id = p_game_id
      and user_id = p_target_user_id;

    perform public.mafia_post_system_message(
      v_game.room_id,
      p_game_id,
      format(
        '[MAFIA_INSPECT_RESULT] targetUserId=%s targetName=%s isMafia=%s',
        p_target_user_id,
        coalesce(v_target_name, 'Member'),
        case when coalesce(v_is_mafia, false) then 'true' else 'false' end
      ),
      'private',
      array[auth.uid()]
    );
  end if;

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
  v_count integer;
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

  insert into public.mafia_phase_adjustments(game_id, day_number, phase, user_id, count)
  values (p_game_id, v_game.day_number, v_game.phase, auth.uid(), 1)
  on conflict (game_id, day_number, phase, user_id) do update
  set count = public.mafia_phase_adjustments.count + 1,
      updated_at = now()
  returning count into v_count;

  if v_count > 2 then
    raise exception 'MAFIA_PHASE_ADJUST_LIMIT';
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

  return v_id;
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
  v_actual_dead uuid;
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
          phase = 'night',
          phase_started_at = now(),
          phase_ends_at = now() + interval '60 seconds',
          day_number = 1
      where id = p_game_id;
      perform public.mafia_post_system_message(v_game.room_id, p_game_id, '[MAFIA_NIGHT_START] day=1');
    end if;

    return public.mafia_get_state(v_game.room_id);
  end if;

  if v_game.status = 'running' and public.mafia_finish_if_winner(p_game_id) then
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

    if v_kill is not null and v_kill is distinct from v_save then
      v_actual_dead := v_kill;

      if exists (
        select 1
        from public.mafia_players
        where game_id = p_game_id
          and user_id = v_kill
          and role = 'lover'
          and alive
          and left_at is null
      ) then
        select user_id into v_actual_dead
        from public.mafia_players
        where game_id = p_game_id
          and user_id <> v_kill
          and role = 'lover'
          and alive
          and left_at is null
        order by joined_at
        limit 1;

        v_actual_dead := coalesce(v_actual_dead, v_kill);
      end if;

      select display_name into v_target_name
      from public.mafia_players
      where game_id = p_game_id and user_id = v_actual_dead;

      update public.mafia_players
      set alive = false,
          died_at = now(),
          death_reason = 'mafia'
      where game_id = p_game_id
        and user_id = v_actual_dead
        and alive
        and left_at is null;

      perform public.mafia_post_system_message(
        v_game.room_id,
        p_game_id,
        format('[MAFIA_NIGHT_KILL] userId=%s name=%s', v_actual_dead, coalesce(v_target_name, 'Member'))
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

revoke all on function public.mafia_start_now(uuid) from public;
grant execute on function public.mafia_start_now(uuid) to authenticated;
grant execute on function public.mafia_start_lobby(uuid, integer) to authenticated;
grant execute on function public.mafia_tick(uuid) to authenticated;
grant execute on function public.mafia_night_action(uuid, uuid, public.mafia_action_type) to authenticated;
grant execute on function public.mafia_extend_phase(uuid, integer) to authenticated;
grant execute on function public.mafia_send_scoped_message(uuid, text, public.mafia_message_visibility) to authenticated;

create or replace function public.get_my_room_summaries()
returns table (
  room_id uuid,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    membership.room_id,
    case
      when latest.story_id is not null then '스토리를 올렸습니다.'
      when latest.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      when latest.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      else public.mafia_display_text(nullif(trim(latest.body), ''))
    end as last_message,
    latest.created_at as last_message_at,
    coalesce(unread.count, 0)::bigint as unread_count
  from public.room_memberships membership
  left join public.room_read_receipts receipt
    on receipt.room_id = membership.room_id
   and receipt.user_id = membership.user_id
  left join lateral (
    select message.kind, message.body, message.story_id, message.created_at
    from public.messages message
    where message.room_id = membership.room_id
      and message.deleted_at is null
      and coalesce(message.mafia_visibility, 'public'::public.mafia_message_visibility) = 'public'::public.mafia_message_visibility
      and (
        message.kind <> 'secret'::public.message_kind
        or message.sender_user_id = auth.uid()
        or message.secret_recipient_user_id = auth.uid()
        or public.is_system_admin()
      )
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)
    from public.messages message
    where message.room_id = membership.room_id
      and message.deleted_at is null
      and coalesce(message.mafia_visibility, 'public'::public.mafia_message_visibility) = 'public'::public.mafia_message_visibility
      and message.created_at > coalesce(receipt.last_read_at, membership.joined_at, now())
      and (message.sender_user_id is null or message.sender_user_id <> auth.uid())
      and (
        message.kind <> 'secret'::public.message_kind
        or message.secret_recipient_user_id = auth.uid()
        or public.is_system_admin()
      )
  ) unread on true
  where membership.user_id = auth.uid()
    and membership.status = 'active';
$$;

revoke all on function public.get_my_room_summaries() from public;
grant execute on function public.get_my_room_summaries() to authenticated;

create or replace function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_name text;
  v_sender_name text;
  v_body text;
begin
  if coalesce(new.mafia_visibility, 'public'::public.mafia_message_visibility) <> 'public'::public.mafia_message_visibility then
    return new;
  end if;

  if new.sender_user_id is null then
    return new;
  end if;

  select name into v_room_name from public.rooms where id = new.room_id;

  select coalesce(nullif(trim(rp.display_name), ''), nullif(trim(u.raw_user_meta_data->>'display_name'), ''), '멤버')
  into v_sender_name
  from auth.users u
  left join public.room_profiles rp
    on rp.room_id = new.room_id and rp.user_id = new.sender_user_id
  where u.id = new.sender_user_id;

  v_body := case
    when new.story_id is not null then '스토리를 올렸습니다.'
    when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
    when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
    else public.mafia_display_text(nullif(trim(new.body), ''))
  end;

  insert into public.push_outbox(user_id, title, body, data)
  select
    membership.user_id,
    coalesce(v_room_name, '뮤트'),
    coalesce(v_sender_name, '멤버') || ': ' || coalesce(v_body, '새 메시지'),
    jsonb_build_object('type', 'message', 'roomId', new.room_id, 'messageId', new.id)
  from public.room_memberships membership
  left join public.room_notification_preferences pref
    on pref.room_id = membership.room_id and pref.user_id = membership.user_id
  where membership.room_id = new.room_id
    and membership.status = 'active'
    and membership.left_at is null
    and membership.user_id <> new.sender_user_id
    and coalesce(pref.enabled, true)
    and exists (
      select 1
      from public.push_devices device
      where device.user_id = membership.user_id
        and device.enabled
    )
    and (
      new.kind <> 'secret'::public.message_kind
      or new.secret_recipient_user_id = membership.user_id
    );

  return new;
end;
$$;
