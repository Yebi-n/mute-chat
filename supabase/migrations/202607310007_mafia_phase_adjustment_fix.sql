alter table public.mafia_phase_adjustments
  add column if not exists updated_at timestamptz not null default now();

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

  insert into public.mafia_phase_adjustments(game_id, day_number, phase, user_id, count, updated_at)
  values (p_game_id, v_game.day_number, v_game.phase, auth.uid(), 1, now())
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
    format(
      case when p_delta_seconds < 0
        then '[MAFIA_TIME_SHORTENED] userId=%s name=%s'
        else '[MAFIA_TIME_EXTENDED] userId=%s name=%s'
      end,
      auth.uid(),
      coalesce(v_actor_name, '멤버')
    )
  );

  return public.mafia_get_state(v_game.room_id);
end;
$$;

grant execute on function public.mafia_extend_phase(uuid, integer) to authenticated;
