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

  if v_body like '[MAFIA_CANCELLED%' then
    return '참여 인원이 부족하여 마피아 게임이 취소되었습니다';
  elsif v_body like '[MAFIA_EXECUTION_REJECTED%' then
    return '찬성이 과반을 넘지 않아 아무도 처형되지 않았습니다';
  elsif v_body like '[MAFIA_NIGHT_KILL%' then
    return coalesce(v_target_name, '대상') || '님이 마피아의 총에 맞아 사망했습니다';
  elsif v_body like '[MAFIA_FORCE_ENDED%' then
    return coalesce(v_name, '진행자') || '님이 게임을 강제 종료하였습니다';
  elsif v_body like '[MAFIA_LOBBY%' then
    return '마피아 게임에 참여하시겠습니까? 1분 후 시작됩니다.';
  elsif v_body like '[MAFIA_CANCEL_JOIN%' then
    v_name := coalesce(v_name, nullif(substring(v_body from 'user=([^ ]+)'), ''));
    return coalesce(v_name, '멤버') || '님이 마피아 게임 참여를 취소했습니다.';
  elsif v_body like '[MAFIA_DAY_START%' then
    return coalesce(v_day, '1') || '일 차 낮이 되었습니다';
  elsif v_body like '[MAFIA_DAY_VOTE_START%' then
    return '투표를 시작합니다';
  elsif v_body like '[MAFIA_NO_EXECUTION%' then
    return '투표 결과 처형 없이 밤이 되었습니다';
  elsif v_body like '[MAFIA_FINAL_DEFENSE%' then
    return coalesce(v_name, '대상') || '님이 최후의 반론을 시작합니다';
  elsif v_body like '[MAFIA_FINAL_VOTE_START%' then
    return '찬반 투표를 시작합니다';
  elsif v_body like '[MAFIA_EXECUTED%' then
    return coalesce(v_name, '대상') || '님이 사망하셨습니다. ' ||
      coalesce(v_name, '대상') || '님은 ' ||
      case when v_role = 'mafia' then '마피아였습니다' else '마피아가 아니었습니다' end;
  elsif v_body like '[MAFIA_NIGHT_START%' then
    return coalesce(v_day, '1') || '일 차 밤이 되었습니다';
  elsif v_body like '[MAFIA_NIGHT_NO_DEATH%' then
    return '밤사이 아무도 사망하지 않았습니다';
  elsif v_body like '[MAFIA_GAME_END%' then
    return case when v_winner = 'mafia' then '마피아가 승리했습니다' else '시민이 승리했습니다' end;
  elsif v_body like '[MAFIA_INSPECT_RESULT%' then
    return '조사 결과: ' || coalesce(v_target_name, '대상') || '님은 ' ||
      case when v_is_mafia = 'true' then '마피아입니다' else '마피아가 아닙니다' end;
  end if;

  return p_body;
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
  if p_capacity < 5 or p_capacity > 20 then raise exception 'INVALID_CAPACITY'; end if;

  select count(*) into v_member_count
  from public.room_memberships
  where room_id = p_room_id
    and status = 'active'
    and left_at is null;

  if coalesce(v_member_count, 0) < 5 then
    raise exception 'MAFIA_MIN_MEMBERS_REQUIRED';
  end if;

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

create or replace function public.queue_message_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind not in (
    'text'::public.message_kind,
    'image'::public.message_kind,
    'secret'::public.message_kind,
    'system'::public.message_kind
  ) then
    return new;
  end if;

  insert into public.user_notifications(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case
      when new.story_id is not null then 'story'
      when new.kind = 'system'::public.message_kind then 'room_notice'
      when new.kind = 'secret'::public.message_kind then 'secret_message'
      else 'chat_message'
    end,
    case
      when new.kind = 'system'::public.message_kind and new.story_id is null then room.name
      else coalesce(sender_profile.display_name, '멤버')
    end,
    case
      when new.story_id is not null then '스토리를 올렸습니다.'
      when new.kind = 'system'::public.message_kind then left(public.mafia_display_text(coalesce(new.body, '')), 100)
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', case
        when new.story_id is not null then 'story'
        when new.kind = 'system'::public.message_kind then 'room_notice'
        else 'chat'
      end,
      'roomId', new.room_id,
      'messageId', new.id,
      'storyId', new.story_id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(sender_profile.display_name, '멤버'),
      'senderAvatarPath', sender_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and new.sender_user_id is not null
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  insert into public.push_outbox(recipient_user_id, event_type, title, body, data)
  select
    membership.user_id,
    case
      when new.story_id is not null then 'story'
      when new.kind = 'system'::public.message_kind then 'room_notice'
      when new.kind = 'secret'::public.message_kind then 'secret_message'
      else 'chat_message'
    end,
    case
      when new.kind = 'system'::public.message_kind and new.story_id is null then room.name
      else coalesce(sender_profile.display_name, '멤버')
    end,
    case
      when new.story_id is not null then '스토리를 올렸습니다.'
      when new.kind = 'system'::public.message_kind then left(public.mafia_display_text(coalesce(new.body, '')), 100)
      when new.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      when new.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      else left(coalesce(new.body, ''), 100)
    end,
    jsonb_build_object(
      'type', case
        when new.story_id is not null then 'story'
        when new.kind = 'system'::public.message_kind then 'room_notice'
        else 'chat'
      end,
      'roomId', new.room_id,
      'messageId', new.id,
      'storyId', new.story_id,
      'roomName', room.name,
      'roomCoverPath', room.cover_asset_path,
      'senderName', coalesce(sender_profile.display_name, '멤버'),
      'senderAvatarPath', sender_profile.avatar_asset_path
    )
  from public.room_memberships membership
  join public.rooms room on room.id = new.room_id
  left join public.room_profiles sender_profile
    on sender_profile.room_id = new.room_id
   and sender_profile.user_id = new.sender_user_id
  left join public.room_user_preferences preference
    on preference.room_id = membership.room_id
   and preference.user_id = membership.user_id
  where membership.room_id = new.room_id
    and room.category <> 'adult'
    and membership.status = 'active'
    and new.sender_user_id is not null
    and membership.user_id <> new.sender_user_id
    and coalesce(preference.notifications_enabled, true)
    and (
      new.kind <> 'secret'::public.message_kind
      or membership.user_id = new.secret_recipient_user_id
    );

  return new;
end;
$$;

grant execute on function public.mafia_display_text(text) to authenticated;
grant execute on function public.mafia_start_lobby(uuid, integer) to authenticated;
