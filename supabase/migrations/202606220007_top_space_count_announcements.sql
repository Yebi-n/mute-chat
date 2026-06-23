drop function if exists public.boost_room_top_space(uuid, integer);

create function public.boost_room_top_space(
  p_room_id uuid,
  p_points integer
) returns table (
  expires_at timestamptz,
  total_duration_seconds integer,
  point_balance integer,
  boost_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer;
  v_current_expires timestamptz;
  v_remaining integer;
  v_display_name text;
begin
  v_seconds := case p_points
    when 100 then 20
    when 500 then 80
    when 1000 then 180
    when 2000 then 280
    when 5000 then 680
    when 10000 then 1600
    when 30000 then 4800
    when 50000 then 8000
    else null
  end;
  if v_seconds is null then raise exception 'INVALID_TOP_SPACE_PACKAGE'; end if;

  if not public.is_active_room_member(p_room_id) then
    raise exception 'ROOM_MEMBERS_ONLY';
  end if;

  update public.users as app_user
  set point_balance = app_user.point_balance - p_points,
      updated_at = now()
  where app_user.id = auth.uid()
    and app_user.point_balance >= p_points
  returning app_user.point_balance into point_balance;

  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  select rts.expires_at into v_current_expires
  from public.room_top_spaces rts
  where rts.room_id = p_room_id
  for update;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_current_expires, now()) - now()))::integer
  );

  insert into public.room_top_spaces(
    room_id,
    expires_at,
    total_duration_seconds,
    boost_count,
    updated_at
  )
  values (
    p_room_id,
    now() + make_interval(secs => v_remaining + v_seconds),
    v_remaining + v_seconds,
    1,
    now()
  )
  on conflict (room_id) do update
  set expires_at = excluded.expires_at,
      total_duration_seconds = excluded.total_duration_seconds,
      boost_count = public.room_top_spaces.boost_count + 1,
      updated_at = now()
  returning
    public.room_top_spaces.expires_at,
    public.room_top_spaces.total_duration_seconds,
    public.room_top_spaces.boost_count
  into expires_at, total_duration_seconds, boost_count;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -p_points, 'room_top_space', p_room_id::text);

  select coalesce(nullif(trim(profile.display_name), ''), '멤버')
  into v_display_name
  from public.room_profiles profile
  where profile.room_id = p_room_id
    and profile.user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    auth.uid(),
    'system',
    coalesce(v_display_name, '멤버') || '님이 탑스페이스를 ' || boost_count::text || '회 올렸습니다.'
  );

  update public.rooms set updated_at = now() where id = p_room_id;
  return next;
end;
$$;

revoke all on function public.boost_room_top_space(uuid, integer) from public;
grant execute on function public.boost_room_top_space(uuid, integer) to authenticated;
