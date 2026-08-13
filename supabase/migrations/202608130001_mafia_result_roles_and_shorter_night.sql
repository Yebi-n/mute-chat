create or replace function public.mafia_role_reveal_payload(p_game_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    string_agg(
      concat_ws(
        ',',
        p.user_id::text,
        coalesce(p.role::text, 'unknown'),
        replace(
          replace(
            replace(
              replace(coalesce(nullif(p.display_name, ''), 'Member'), '%', '%25'),
              '|', '%7C'
            ),
            ',', '%2C'
          ),
          ' ', '%20'
        )
      ),
      '|'
      order by p.joined_at
    ),
    ''
  )
  from public.mafia_players p
  where p.game_id = p_game_id
    and p.left_at is null;
$$;

create or replace function public.mafia_finish_if_winner(p_game_id uuid) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner public.mafia_team;
  v_room_id uuid;
  v_roles text;
begin
  v_winner := public.mafia_check_winner(p_game_id);
  if v_winner is null then return false; end if;

  update public.mafia_games
  set status = 'ended',
      phase = 'ended',
      winner = v_winner,
      ended_at = now(),
      phase_ends_at = now(),
      updated_at = now()
  where id = p_game_id
  returning room_id into v_room_id;

  v_roles := public.mafia_role_reveal_payload(p_game_id);

  perform public.mafia_post_system_message(
    v_room_id,
    p_game_id,
    format('[MAFIA_GAME_END] winner=%s roles=%s', v_winner, v_roles)
  );
  return true;
end;
$$;

create or replace function public.mafia_cap_night_phase_duration()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'running'
     and new.phase = 'night'
     and (tg_op = 'INSERT' or old.phase is distinct from new.phase)
     and new.phase_started_at is not null
     and (new.phase_ends_at is null or new.phase_ends_at > new.phase_started_at + interval '35 seconds') then
    new.phase_ends_at := new.phase_started_at + interval '35 seconds';
  end if;

  return new;
end;
$$;

drop trigger if exists mafia_cap_night_phase_duration_trigger on public.mafia_games;
create trigger mafia_cap_night_phase_duration_trigger
before insert or update on public.mafia_games
for each row
execute function public.mafia_cap_night_phase_duration();

revoke all on function public.mafia_role_reveal_payload(uuid) from public;
revoke all on function public.mafia_role_reveal_payload(uuid) from anon;
revoke all on function public.mafia_role_reveal_payload(uuid) from authenticated;
revoke all on function public.mafia_cap_night_phase_duration() from public;
revoke all on function public.mafia_cap_night_phase_duration() from anon;
revoke all on function public.mafia_cap_night_phase_duration() from authenticated;

