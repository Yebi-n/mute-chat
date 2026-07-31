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
  elsif v_body like '[MAFIA_NIGHT_SAVED%' then
    return coalesce(v_target_name, '대상') || '님이 마피아에게 총을 맞았지만, 의사의 도움으로 살아났습니다';
  elsif v_body like '[MAFIA_NIGHT_KILL%' then
    return coalesce(v_target_name, '대상') || '님이 마피아의 총에 맞아 사망했습니다';
  elsif v_body like '[MAFIA_FORCE_ENDED%' then
    return coalesce(v_name, '진행자') || '님이 게임을 강제 종료하였습니다';
  elsif v_body like '[MAFIA_LOBBY%' then
    return '마피아 게임에 참여하시겠습니까? 1분 후 시작합니다';
  elsif v_body like '[MAFIA_CANCEL_JOIN%' then
    v_name := coalesce(v_name, nullif(substring(v_body from 'user=([^ ]+)'), ''));
    return coalesce(v_name, '멤버') || '님이 마피아 게임 참여를 취소했습니다';
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
    return case when v_winner = 'mafia' then '마피아팀이 승리하였습니다' else '시민팀이 승리하였습니다' end;
  elsif v_body like '[MAFIA_INSPECT_RESULT%' then
    return coalesce(v_target_name, '대상') || '님은 ' ||
      case when v_is_mafia = 'true' then '마피아였습니다' else '마피아가 아니었습니다' end;
  end if;

  return p_body;
end;
$$;

create or replace function public.mafia_cancel_join(p_game_id uuid) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.mafia_games%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.mafia_games where id = p_game_id for update;
  if not found or v_game.status <> 'waiting' or v_game.phase <> 'lobby' then
    raise exception 'GAME_NOT_JOINABLE';
  end if;

  update public.mafia_players
  set left_at = now()
  where game_id = p_game_id and user_id = auth.uid();

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
  where game_id = p_game_id and user_id = auth.uid() and alive and left_at is null;

  if v_role is null then raise exception 'NOT_ALIVE_PLAYER'; end if;
  if (p_action_type = 'kill' and v_role <> 'mafia')
     or (p_action_type = 'save' and v_role <> 'doctor')
     or (p_action_type = 'inspect' and v_role <> 'police') then
    raise exception 'INVALID_ROLE_ACTION';
  end if;
  if p_target_user_id is null then raise exception 'TARGET_REQUIRED'; end if;

  select display_name, role
  into v_target_name, v_target_role
  from public.mafia_players
  where game_id = p_game_id and user_id = p_target_user_id and alive and left_at is null;

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
      and not (
        message.kind = 'system'::public.message_kind
        and message.mafia_game_id is not null
        and coalesce(message.body, '') like '[MAFIA_%'
      )
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
      and not (
        message.kind = 'system'::public.message_kind
        and message.mafia_game_id is not null
        and coalesce(message.body, '') like '[MAFIA_%'
      )
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
  begin
    if coalesce(new.mafia_visibility, 'public'::public.mafia_message_visibility) <> 'public'::public.mafia_message_visibility then
      return new;
    end if;

    if new.kind = 'system'::public.message_kind
       and new.mafia_game_id is not null
       and coalesce(new.body, '') like '[MAFIA_%' then
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
  exception when others then
    return new;
  end;
end;
$$;

revoke all on function public.mafia_cancel_join(uuid) from public;
grant execute on function public.mafia_cancel_join(uuid) to authenticated;
grant execute on function public.mafia_night_action(uuid, uuid, public.mafia_action_type) to authenticated;
grant execute on function public.mafia_tick(uuid) to authenticated;
grant execute on function public.get_my_room_summaries() to authenticated;
