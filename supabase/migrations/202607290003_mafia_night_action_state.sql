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
        with kill_counts as (
          select target_user_id, count(*) as votes, min(created_at) as first_selected_at
          from public.mafia_actions
          where game_id = v_game.id
            and day_number = v_game.day_number
            and phase = 'night'
            and action_type = 'kill'
            and target_user_id is not null
          group by target_user_id
          order by count(*) desc, min(created_at)
          limit 1
        )
        select jsonb_build_object(
          'targetUserId', p.user_id,
          'targetName', coalesce(p.display_name, 'Member')
        )
        from kill_counts k
        join public.mafia_players p on p.game_id = v_game.id and p.user_id = k.target_user_id
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

revoke all on function public.mafia_get_state(uuid) from public;
grant execute on function public.mafia_get_state(uuid) to authenticated;
