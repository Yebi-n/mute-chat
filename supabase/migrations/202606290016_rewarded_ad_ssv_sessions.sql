create table if not exists public.rewarded_ad_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('attendance', 'rewarded_ad')),
  status text not null default 'pending'
    check (status in ('pending', 'rewarded', 'rejected', 'expired')),
  expires_at timestamptz not null default (now() + interval '20 minutes'),
  transaction_id text unique,
  ad_unit text,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  rewarded_at timestamptz
);

create index if not exists rewarded_ad_sessions_user_created
  on public.rewarded_ad_sessions(user_id, created_at desc);
create index if not exists rewarded_ad_sessions_pending_expiry
  on public.rewarded_ad_sessions(expires_at)
  where status = 'pending';

alter table public.rewarded_ad_sessions enable row level security;
drop policy if exists rewarded_ad_sessions_read_own on public.rewarded_ad_sessions;
create policy rewarded_ad_sessions_read_own
on public.rewarded_ad_sessions for select to authenticated
using (user_id = auth.uid());

create or replace function public.create_rewarded_ad_session(p_reward_type text)
returns table(session_id uuid, user_id uuid, custom_data text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reward_type not in ('attendance', 'rewarded_ad') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_reward_type, 0));

  if exists (
    select 1 from public.reward_claims claim
    where claim.user_id = v_user_id
      and claim.reward_type = p_reward_type
      and claim.created_at > now() - interval '1 hour'
  ) then
    if p_reward_type = 'attendance' then
      raise exception 'REWARD_COOLDOWN';
    end if;
    raise exception 'REWARDED_AD_ALREADY_CLAIMED';
  end if;

  update public.rewarded_ad_sessions session
  set status = 'expired'
  where session.user_id = v_user_id
    and session.reward_type = p_reward_type
    and session.status = 'pending';

  insert into public.rewarded_ad_sessions(user_id, reward_type)
  values (v_user_id, p_reward_type)
  returning id into v_session_id;

  return query select v_session_id, v_user_id, v_session_id::text;
end;
$$;

create or replace function public.grant_verified_rewarded_ad(
  p_session_id uuid,
  p_user_id uuid,
  p_transaction_id text,
  p_ad_unit text
) returns table(
  rewarded boolean,
  point_balance integer,
  awarded_points integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.rewarded_ad_sessions%rowtype;
  v_points integer;
  v_balance integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if nullif(trim(coalesce(p_transaction_id, '')), '') is null then
    raise exception 'INVALID_AD_TRANSACTION';
  end if;

  select * into v_session
  from public.rewarded_ad_sessions session
  where session.id = p_session_id
  for update;

  if not found or v_session.user_id <> p_user_id then
    raise exception 'AD_SESSION_NOT_FOUND';
  end if;
  if v_session.status = 'rewarded' then
    if v_session.transaction_id is distinct from p_transaction_id then
      raise exception 'AD_SESSION_TRANSACTION_CONFLICT';
    end if;
    select app_user.point_balance into v_balance
    from public.users app_user where app_user.id = p_user_id;
    return query select true, v_balance, 0, v_session.rewarded_at + interval '1 hour';
    return;
  end if;
  if v_session.status <> 'pending' or v_session.expires_at < now() then
    update public.rewarded_ad_sessions set status = 'expired' where id = p_session_id;
    return query select false, 0, 0, null::timestamptz;
    return;
  end if;
  if exists (
    select 1 from public.rewarded_ad_sessions session
    where session.transaction_id = p_transaction_id
      and session.id <> p_session_id
  ) then raise exception 'AD_TRANSACTION_REUSED'; end if;

  if exists (
    select 1 from public.reward_claims claim
    where claim.user_id = p_user_id
      and claim.reward_type = v_session.reward_type
      and claim.created_at > now() - interval '1 hour'
  ) then
    update public.rewarded_ad_sessions
    set status = 'rejected', transaction_id = p_transaction_id,
        ad_unit = p_ad_unit, verified_at = now()
    where id = p_session_id;
    select app_user.point_balance into v_balance
    from public.users app_user where app_user.id = p_user_id;
    return query select false, v_balance, 0, null::timestamptz;
    return;
  end if;

  v_points := case when v_session.reward_type = 'attendance' then 20 else 10 end;

  insert into public.reward_claims(user_id, reward_type, reward_key, points)
  values (p_user_id, v_session.reward_type, 'admob:' || p_transaction_id, v_points);
  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (p_user_id, v_points, v_session.reward_type, 'admob:' || p_transaction_id);
  update public.users app_user
  set point_balance = app_user.point_balance + v_points, updated_at = now()
  where app_user.id = p_user_id
  returning app_user.point_balance into v_balance;
  update public.rewarded_ad_sessions
  set status = 'rewarded', transaction_id = p_transaction_id,
      ad_unit = p_ad_unit, verified_at = now(), rewarded_at = now()
  where id = p_session_id;

  return query select true, v_balance, v_points, now() + interval '1 hour';
end;
$$;

create or replace function public.get_rewarded_ad_session_result(p_session_id uuid)
returns table(
  status text,
  point_balance integer,
  awarded_points integer,
  next_available_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    session.status,
    app_user.point_balance,
    case
      when session.status = 'rewarded' and session.reward_type = 'attendance' then 20
      when session.status = 'rewarded' then 10
      else 0
    end,
    case when session.rewarded_at is not null
      then session.rewarded_at + interval '1 hour' else null end
  from public.rewarded_ad_sessions session
  join public.users app_user on app_user.id = session.user_id
  where session.id = p_session_id and session.user_id = auth.uid();
$$;

revoke all on function public.create_rewarded_ad_session(text) from public;
revoke all on function public.grant_verified_rewarded_ad(uuid,uuid,text,text) from public;
revoke all on function public.get_rewarded_ad_session_result(uuid) from public;
grant execute on function public.create_rewarded_ad_session(text) to authenticated;
grant execute on function public.grant_verified_rewarded_ad(uuid,uuid,text,text) to service_role;
grant execute on function public.get_rewarded_ad_session_result(uuid) to authenticated;
