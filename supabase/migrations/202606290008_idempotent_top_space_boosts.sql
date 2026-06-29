create table if not exists public.room_top_space_requests (
  user_id uuid not null references public.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 12 and 120),
  room_id uuid not null references public.rooms(id) on delete cascade,
  points integer not null check (points > 0),
  expires_at timestamptz,
  total_duration_seconds integer,
  point_balance integer,
  boost_count integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, request_id)
);

create index if not exists room_top_space_requests_user_created
  on public.room_top_space_requests(user_id, created_at desc);

alter table public.room_top_space_requests enable row level security;

create or replace function public.boost_room_top_space(
  p_room_id uuid,
  p_points integer,
  p_request_id text
) returns table(
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
  v_user_id uuid := auth.uid();
  v_seconds integer;
  v_boosts integer;
  v_current_expires timestamptz;
  v_remaining integer;
  v_display_name text;
  v_existing public.room_top_space_requests%rowtype;
  v_claimed integer := 0;
  v_result_expires_at timestamptz;
  v_result_total_duration_seconds integer;
  v_result_point_balance integer;
  v_result_boost_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null or char_length(trim(p_request_id)) not between 12 and 120 then
    raise exception 'TOP_SPACE_REQUEST_INVALID';
  end if;

  select package.seconds, package.boosts into v_seconds, v_boosts
  from (values
    (100,45,60), (500,270,360), (1000,600,800), (2000,1260,1680),
    (5000,3600,4800), (10000,9000,12000),
    (30000,36000,48000), (50000,72000,96000)
  ) as package(points, seconds, boosts)
  where package.points = p_points;

  if v_seconds is null then raise exception 'INVALID_TOP_SPACE_PACKAGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));
  if not public.is_active_room_member(p_room_id) then raise exception 'ROOM_MEMBERS_ONLY'; end if;

  insert into public.room_top_space_requests(user_id, request_id, room_id, points)
  values (v_user_id, trim(p_request_id), p_room_id, p_points)
  on conflict (user_id, request_id) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 0 then
    select request.* into v_existing
    from public.room_top_space_requests request
    where request.user_id = v_user_id
      and request.request_id = trim(p_request_id);

    if v_existing.room_id is distinct from p_room_id
      or v_existing.points is distinct from p_points then
      raise exception 'TOP_SPACE_IDEMPOTENCY_CONFLICT';
    end if;

    if v_existing.completed_at is null then
      raise exception 'TOP_SPACE_REQUEST_INCOMPLETE';
    end if;

    return query select
      v_existing.expires_at,
      v_existing.total_duration_seconds,
      v_existing.point_balance,
      v_existing.boost_count;
    return;
  end if;

  update public.users app_user
  set point_balance = app_user.point_balance - p_points, updated_at = now()
  where app_user.id = v_user_id and app_user.point_balance >= p_points
  returning app_user.point_balance into v_result_point_balance;

  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  select top_space.expires_at into v_current_expires
  from public.room_top_spaces top_space
  where top_space.room_id = p_room_id
  for update;

  v_remaining := greatest(0,
    extract(epoch from (coalesce(v_current_expires, now()) - now()))::integer
  );

  insert into public.room_top_spaces(
    room_id, expires_at, total_duration_seconds, boost_count, updated_at
  ) values (
    p_room_id, now() + make_interval(secs => v_remaining + v_seconds),
    v_remaining + v_seconds, v_boosts, now()
  )
  on conflict (room_id) do update
  set expires_at = excluded.expires_at,
      total_duration_seconds = excluded.total_duration_seconds,
      boost_count = public.room_top_spaces.boost_count + v_boosts,
      updated_at = now()
  returning public.room_top_spaces.expires_at,
            public.room_top_spaces.total_duration_seconds,
            public.room_top_spaces.boost_count
  into v_result_expires_at, v_result_total_duration_seconds, v_result_boost_count;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (v_user_id, -p_points, 'room_top_space', trim(p_request_id));

  select coalesce(nullif(trim(profile.display_name), ''), '멤버') into v_display_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = v_user_id;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id, v_user_id, 'system',
    coalesce(v_display_name, '멤버') || '님이 탑스페이스를 ' || v_boosts::text || '회 올렸습니다.'
  );

  update public.rooms set updated_at = now() where id = p_room_id;

  update public.room_top_space_requests request
  set expires_at = v_result_expires_at,
      total_duration_seconds = v_result_total_duration_seconds,
      point_balance = v_result_point_balance,
      boost_count = v_result_boost_count,
      completed_at = now()
  where request.user_id = v_user_id
    and request.request_id = trim(p_request_id);

  return query select
    v_result_expires_at,
    v_result_total_duration_seconds,
    v_result_point_balance,
    v_result_boost_count;
end;
$$;

revoke all on function public.boost_room_top_space(uuid, integer, text) from public;
grant execute on function public.boost_room_top_space(uuid, integer, text) to authenticated;

create or replace function public.boost_room_top_space(p_room_id uuid, p_points integer)
returns table(
  expires_at timestamptz,
  total_duration_seconds integer,
  point_balance integer,
  boost_count integer
)
language sql
security definer
set search_path = public
as $$
  select boost.expires_at,
         boost.total_duration_seconds,
         boost.point_balance,
         boost.boost_count
  from public.boost_room_top_space(
    p_room_id,
    p_points,
    'legacy-' || gen_random_uuid()::text
  ) boost;
$$;

revoke all on function public.boost_room_top_space(uuid, integer) from public;
grant execute on function public.boost_room_top_space(uuid, integer) to authenticated;
