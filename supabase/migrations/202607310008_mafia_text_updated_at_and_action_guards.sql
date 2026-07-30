alter table if exists public.mafia_games
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.url_decode(p_text text)
returns text
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(p_text, '');
  v_index integer := 1;
  v_len integer := length(v_text);
  v_hex text;
  v_bytes bytea := ''::bytea;
begin
  v_text := replace(v_text, '+', ' ');
  while v_index <= v_len loop
    if substring(v_text from v_index for 1) = '%' and v_index + 2 <= v_len then
      v_hex := substring(v_text from v_index + 1 for 2);
      if v_hex ~ '^[0-9A-Fa-f]{2}$' then
        v_bytes := v_bytes || decode(v_hex, 'hex');
        v_index := v_index + 3;
      else
        v_bytes := v_bytes || convert_to(substring(v_text from v_index for 1), 'utf8');
        v_index := v_index + 1;
      end if;
    else
      v_bytes := v_bytes || convert_to(substring(v_text from v_index for 1), 'utf8');
      v_index := v_index + 1;
    end if;
  end loop;
  return convert_from(v_bytes, 'utf8');
exception
  when others then
    return p_text;
end;
$$;

create or replace function public.mafia_display_text(p_body text)
returns text
language plpgsql
stable
as $$
declare
  v_body text := coalesce(p_body, '');
  v_name text := nullif(substring(v_body from 'name=([^ ]+)'), '');
  v_target_name text := nullif(substring(v_body from 'targetName=([^ ]+)'), '');
  v_day text := coalesce(nullif(substring(v_body from 'day=([^ ]+)'), ''), '1');
  v_role text := nullif(substring(v_body from 'role=([^ ]+)'), '');
  v_is_mafia text := nullif(substring(v_body from 'isMafia=([^ ]+)'), '');
  v_winner text := nullif(substring(v_body from 'winner=([^ ]+)'), '');
begin
  v_body := regexp_replace(v_body, '^\[([A-Z_]+)_\s+', '[\1] ');
  v_name := nullif(replace(coalesce(v_name, ''), '+', ' '), '');
  v_target_name := nullif(replace(coalesce(v_target_name, v_name, ''), '+', ' '), '');

  if v_name is not null then
    v_name := public.url_decode(v_name);
  end if;
  if v_target_name is not null then
    v_target_name := public.url_decode(v_target_name);
  end if;

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
    return v_day || '일 차 낮이 되었습니다.';
  elsif v_body like '[MAFIA_DAY_VOTE_START%' then
    return '투표를 시작합니다.';
  elsif v_body like '[MAFIA_NO_EXECUTION%' then
    return '투표 결과 처형 없이 밤이 되었습니다.';
  elsif v_body like '[MAFIA_FINAL_DEFENSE%' then
    return coalesce(v_name, '대상') || '님이 최후의 변론을 시작합니다.';
  elsif v_body like '[MAFIA_FINAL_VOTE_START%' then
    return '찬반 투표를 시작합니다.';
  elsif v_body like '[MAFIA_EXECUTED%' then
    return coalesce(v_name, '대상') || '님이 사망하셨습니다. ' || coalesce(v_name, '대상') || '님은 ' ||
      case when v_role = 'mafia' then '마피아였습니다.' else '마피아가 아니었습니다.' end;
  elsif v_body like '[MAFIA_NIGHT_START%' then
    return v_day || '일 차 밤이 되었습니다.';
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
  v_target_role public.mafia_role;
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
  where game_id = p_game_id and user_id = auth.uid() and joined and alive and left_at is null;

  if v_role is null then raise exception 'NOT_ALIVE_PLAYER'; end if;
  if (p_action_type = 'kill' and v_role <> 'mafia')
     or (p_action_type = 'save' and v_role <> 'doctor')
     or (p_action_type = 'inspect' and v_role <> 'police') then
    raise exception 'INVALID_ROLE_ACTION';
  end if;
  if p_target_user_id is null then raise exception 'TARGET_REQUIRED'; end if;

  select role, display_name
  into v_target_role, v_target_name
  from public.mafia_players
  where game_id = p_game_id
    and user_id = p_target_user_id
    and joined
    and alive
    and left_at is null;

  if v_target_role is null then
    raise exception 'INVALID_TARGET';
  end if;
  if p_action_type = 'kill' and v_target_role = 'mafia' then
    raise exception 'INVALID_TARGET';
  end if;
  if p_action_type = 'inspect' and p_target_user_id = auth.uid() then
    raise exception 'INVALID_TARGET';
  end if;

  insert into public.mafia_actions(game_id, day_number, phase, actor_user_id, target_user_id, action_type)
  values (p_game_id, v_game.day_number, 'night', auth.uid(), p_target_user_id, p_action_type)
  on conflict (game_id, day_number, phase, actor_user_id, action_type) do update
  set target_user_id = excluded.target_user_id,
      created_at = now();

  if p_action_type = 'inspect' then
    v_is_mafia := v_target_role = 'mafia';
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

grant execute on function public.mafia_night_action(uuid, uuid, public.mafia_action_type) to authenticated;
