create table if not exists public.room_top_spaces (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  expires_at timestamptz not null,
  total_duration_seconds integer not null check (total_duration_seconds > 0),
  boost_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.room_top_spaces enable row level security;

create policy room_top_spaces_read on public.room_top_spaces
for select to authenticated using (true);

create or replace function public.boost_room_top_space(
  p_room_id uuid,
  p_points integer
) returns table (
  expires_at timestamptz,
  total_duration_seconds integer,
  point_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer;
  v_current_expires timestamptz;
  v_remaining integer;
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

  if not exists (
    select 1 from room_memberships
    where room_id = p_room_id and user_id = auth.uid() and status = 'active'
  ) then raise exception 'ROOM_MEMBERS_ONLY'; end if;

  update users
  set point_balance = point_balance - p_points, updated_at = now()
  where id = auth.uid() and point_balance >= p_points
  returning users.point_balance into point_balance;
  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  select rts.expires_at into v_current_expires
  from room_top_spaces rts
  where rts.room_id = p_room_id
  for update;
  v_remaining := greatest(0, extract(epoch from (coalesce(v_current_expires, now()) - now()))::integer);

  insert into room_top_spaces(room_id, expires_at, total_duration_seconds, boost_count, updated_at)
  values (p_room_id, now() + make_interval(secs => v_remaining + v_seconds), v_remaining + v_seconds, 1, now())
  on conflict (room_id) do update
  set expires_at = excluded.expires_at,
      total_duration_seconds = excluded.total_duration_seconds,
      boost_count = room_top_spaces.boost_count + 1,
      updated_at = now()
  returning room_top_spaces.expires_at, room_top_spaces.total_duration_seconds
  into expires_at, total_duration_seconds;

  insert into point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -p_points, 'room_top_space', p_room_id::text);
  return next;
end;
$$;

revoke all on function public.boost_room_top_space(uuid, integer) from public;
grant execute on function public.boost_room_top_space(uuid, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.room_top_spaces;
exception
  when duplicate_object then null;
end $$;
