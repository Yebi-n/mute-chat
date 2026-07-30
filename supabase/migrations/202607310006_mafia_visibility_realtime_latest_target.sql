do $$
begin
  alter publication supabase_realtime add table public.mafia_actions;
exception when duplicate_object then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.mafia_votes;
exception when duplicate_object then
  null;
end $$;

create or replace function public.mafia_display_text(p_body text)
returns text
language plpgsql
immutable
as $$
declare
  v_body text := coalesce(p_body, '');
  v_name text;
  v_target_name text;
  v_role text;
  v_winner text;
  v_day text;
  v_is_mafia text;
begin
  if v_body not like '[MAFIA_%' then
    return p_body;
  end if;

  v_name := nullif(substring(v_body from 'name=([^ ]+)'), '');
  v_target_name := coalesce(nullif(substring(v_body from 'targetName=([^ ]+)'), ''), v_name);
  v_role := nullif(substring(v_body from 'role=([^ ]+)'), '');
  v_winner := nullif(substring(v_body from 'winner=([^ ]+)'), '');
  v_day := nullif(substring(v_body from 'day=([^ ]+)'), '');
  v_is_mafia := nullif(substring(v_body from 'isMafia=([^ ]+)'), '');

  if v_body like '[MAFIA_CANCEL_JOIN%' then
    return '';
  elsif v_body like '[MAFIA_CANCELLED%' then
    return '참여 인원이 부족하여 마피아 게임이 취소되었습니다.';
  elsif v_body like '[MAFIA_EXECUTION_REJECTED%' then
    return '찬성이 과반을 넘지 않아 아무도 처형되지 않았습니다.';
  elsif v_body like '[MAFIA_NIGHT_SAVED%' then
    return coalesce(v_target_name, '대상') || '님이 마피아에게 총을 맞았지만, 의사의 도움으로 살아났습니다.';
  elsif v_body like '[MAFIA_NIGHT_KILL%' then
    return coalesce(v_target_name, '대상') || '님이 마피아의 총에 맞아 사망했습니다.';
  elsif v_body like '[MAFIA_FORCE_ENDED%' then
    return coalesce(v_name, '진행자') || '님이 게임을 강제 종료하였습니다.';
  elsif v_body like '[MAFIA_LOBBY%' then
    return '마피아 게임에 참여하시겠습니까? 1분 후 시작합니다.';
  elsif v_body like '[MAFIA_DAY_START%' then
    return coalesce(v_day, '1') || '일 차 낮이 되었습니다.';
  elsif v_body like '[MAFIA_DAY_VOTE_START%' then
    return '투표를 시작합니다.';
  elsif v_body like '[MAFIA_NO_EXECUTION%' then
    return '투표 결과 처형 없이 밤이 되었습니다.';
  elsif v_body like '[MAFIA_FINAL_DEFENSE%' then
    return coalesce(v_name, '대상') || '님이 최후의 변론을 시작합니다.';
  elsif v_body like '[MAFIA_FINAL_VOTE_START%' then
    return '찬반 투표를 시작합니다.';
  elsif v_body like '[MAFIA_EXECUTED%' then
    return coalesce(v_name, '대상') || '님이 사망하셨습니다. ' ||
      coalesce(v_name, '대상') || '님은 ' ||
      case when v_role = 'mafia' then '마피아였습니다.' else '마피아가 아니었습니다.' end;
  elsif v_body like '[MAFIA_NIGHT_START%' then
    return coalesce(v_day, '1') || '일 차 밤이 되었습니다.';
  elsif v_body like '[MAFIA_NIGHT_NO_DEATH%' then
    return '밤사이 아무도 사망하지 않았습니다.';
  elsif v_body like '[MAFIA_GAME_END%' then
    return case when v_winner = 'mafia' then '마피아팀이 승리하였습니다.' else '시민팀이 승리하였습니다.' end;
  elsif v_body like '[MAFIA_INSPECT_RESULT%' then
    return coalesce(v_target_name, '대상') || '님은 ' ||
      case when v_is_mafia = 'true' then '마피아가 맞습니다.' else '마피아가 아닙니다.' end;
  elsif v_body like '[MAFIA_TIME_SHORTENED%' then
    return coalesce(v_name, '멤버') || '님이 시간을 단축하였습니다.';
  elsif v_body like '[MAFIA_TIME_EXTENDED%' then
    return coalesce(v_name, '멤버') || '님이 시간을 연장하였습니다.';
  end if;

  return p_body;
end;
$$;

create or replace function public.mafia_is_message_visible(
  p_room_id uuid,
  p_sender_user_id uuid,
  p_kind public.message_kind,
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
              and auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'::uuid[]))
            )
            or (
              p_mafia_visibility in (
                'spectator'::public.mafia_message_visibility,
                'mafia'::public.mafia_message_visibility,
                'lover'::public.mafia_message_visibility
              )
              and (
                auth.uid() = any(coalesce(p_mafia_recipient_user_ids, '{}'::uuid[]))
                or exists (
                  select 1
                  from public.mafia_players me
                  where me.game_id = p_mafia_game_id
                    and me.user_id = auth.uid()
                    and me.left_at is null
                    and me.alive = false
                )
              )
            )
          )
        )
      )
    );
$$;

create or replace function public.mafia_get_state(p_room_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
  v_me public.mafia_players%rowtype;
  v_night_actions jsonb := '{}'::jsonb;
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

  if v_game.status = 'running' and v_game.phase = 'night' and v_me.user_id is not null then
    v_night_actions := jsonb_build_object(
      'kill',
      case when v_me.role = 'mafia' then (
        select jsonb_build_object(
          'targetUserId', p.user_id,
          'targetName', coalesce(p.display_name, 'Member')
        )
        from public.mafia_actions a
        join public.mafia_players p on p.game_id = a.game_id and p.user_id = a.target_user_id
        where a.game_id = v_game.id
          and a.day_number = v_game.day_number
          and a.phase = 'night'
          and a.action_type = 'kill'
          and a.target_user_id is not null
          and p.alive
          and p.left_at is null
          and p.role <> 'mafia'
        order by a.created_at desc, random()
        limit 1
      ) else null end,
      'save',
      case when v_me.role = 'doctor' then (
        select jsonb_build_object(
          'targetUserId', p.user_id,
          'targetName', coalesce(p.display_name, 'Member')
        )
        from public.mafia_actions a
        join public.mafia_players p on p.game_id = a.game_id and p.user_id = a.target_user_id
        where a.game_id = v_game.id
          and a.day_number = v_game.day_number
          and a.phase = 'night'
          and a.action_type = 'save'
          and a.actor_user_id = auth.uid()
        order by a.created_at desc
        limit 1
      ) else null end,
      'inspect',
      case when v_me.role = 'police' then (
        select jsonb_build_object(
          'targetUserId', p.user_id,
          'targetName', coalesce(p.display_name, 'Member')
        )
        from public.mafia_actions a
        join public.mafia_players p on p.game_id = a.game_id and p.user_id = a.target_user_id
        where a.game_id = v_game.id
          and a.day_number = v_game.day_number
          and a.phase = 'night'
          and a.action_type = 'inspect'
          and a.actor_user_id = auth.uid()
        order by a.created_at desc
        limit 1
      ) else null end
    );
  end if;

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
    'nightActions', v_night_actions,
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
    select action.target_user_id into v_kill
    from public.mafia_actions action
    where action.game_id = p_game_id
      and action.day_number = v_game.day_number
      and action.phase = 'night'
      and action.action_type = 'kill'
      and action.target_user_id is not null
      and exists (
        select 1
        from public.mafia_players target
        where target.game_id = p_game_id
          and target.user_id = action.target_user_id
          and target.alive
          and target.left_at is null
          and target.role <> 'mafia'
      )
    order by action.created_at desc, random()
    limit 1;

    select target_user_id into v_save
    from public.mafia_actions
    where game_id = p_game_id
      and day_number = v_game.day_number
      and phase = 'night'
      and action_type = 'save'
      and target_user_id is not null
    order by created_at desc
    limit 1;

    if v_kill is not null and v_kill is not distinct from v_save then
      select display_name into v_target_name
      from public.mafia_players
      where game_id = p_game_id and user_id = v_kill;

      perform public.mafia_post_system_message(
        v_game.room_id,
        p_game_id,
        format('[MAFIA_NIGHT_SAVED] userId=%s targetName=%s', v_kill, coalesce(v_target_name, 'Member'))
      );
    elsif v_kill is not null then
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

revoke all on function public.mafia_display_text(text) from public;
revoke all on function public.mafia_is_message_visible(uuid, uuid, public.message_kind, uuid, uuid, public.mafia_message_visibility, uuid[]) from public;
revoke all on function public.mafia_get_state(uuid) from public;
revoke all on function public.mafia_tick(uuid) from public;

grant execute on function public.mafia_display_text(text) to authenticated;
grant execute on function public.mafia_is_message_visible(uuid, uuid, public.message_kind, uuid, uuid, public.mafia_message_visibility, uuid[]) to authenticated;
grant execute on function public.mafia_get_state(uuid) to authenticated;
grant execute on function public.mafia_tick(uuid) to authenticated;
