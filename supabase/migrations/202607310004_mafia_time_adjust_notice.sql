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
    return coalesce(v_name, '대상') || '님이 최후의 반론을 시작합니다.';
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
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_game
  from public.mafia_games
  where id = p_game_id
  for update;

  if not found or v_game.status <> 'running' or v_game.phase <> 'day_discussion' then
    raise exception 'NOT_EXTENDABLE';
  end if;

  select display_name into v_actor_name
  from public.mafia_players
  where game_id = p_game_id
    and user_id = auth.uid()
    and alive
    and left_at is null;

  if v_actor_name is null then
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

  update public.mafia_games
  set phase_ends_at = v_next
  where id = p_game_id;

  perform public.mafia_post_system_message(
    v_game.room_id,
    p_game_id,
    coalesce(v_actor_name, '멤버') ||
      case
        when p_delta_seconds < 0 then '님이 시간을 단축하였습니다.'
        else '님이 시간을 연장하였습니다.'
      end
  );

  return public.mafia_get_state(v_game.room_id);
end;
$$;

grant execute on function public.mafia_display_text(text) to authenticated;
grant execute on function public.mafia_extend_phase(uuid, integer) to authenticated;
