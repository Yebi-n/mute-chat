do $$
begin
  alter publication supabase_realtime add table public.mafia_games;
exception
  when duplicate_object then null;
end
$$;

create or replace function public.mafia_post_system_message(
  p_room_id uuid,
  p_game_id uuid,
  p_body text,
  p_visibility public.mafia_message_visibility default 'public',
  p_recipient_user_ids uuid[] default '{}'::uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz := clock_timestamp();
begin
  insert into public.messages(
    room_id,
    sender_user_id,
    kind,
    body,
    mafia_game_id,
    mafia_visibility,
    mafia_recipient_user_ids,
    created_at
  )
  values (
    p_room_id,
    null,
    'system',
    p_body,
    p_game_id,
    p_visibility,
    p_recipient_user_ids,
    v_created_at
  )
  returning id into v_id;

  update public.rooms
  set updated_at = v_created_at
  where id = p_room_id;

  return v_id;
end;
$$;

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
  end if;

  return p_body;
end;
$$;
