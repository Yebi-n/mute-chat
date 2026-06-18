alter table public.users
  add column if not exists point_balance integer not null default 0
  check (point_balance >= 0);

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists point_ledger_user_created
  on public.point_ledger(user_id, created_at desc);

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_type text not null check (reward_type in ('attendance', 'rewarded_ad')),
  reward_key text not null,
  points integer not null check (points > 0),
  created_at timestamptz not null default now(),
  unique (user_id, reward_type, reward_key)
);

create table if not exists public.user_entitlements (
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null,
  entitlement_type text not null check (entitlement_type in ('bubble_color', 'text_color', 'custom_color', 'ad_free')),
  value text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.point_ledger enable row level security;
alter table public.reward_claims enable row level security;
alter table public.user_entitlements enable row level security;

create policy point_ledger_read_own on public.point_ledger
for select to authenticated using (user_id = auth.uid());

create policy entitlements_read_own on public.user_entitlements
for select to authenticated using (user_id = auth.uid());

create or replace function public.get_my_wallet()
returns table (
  point_balance integer,
  attendance_available_at timestamptz,
  rewarded_ad_available boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.point_balance,
    coalesce((
      select max(rc.created_at) + interval '30 minutes'
      from reward_claims rc
      where rc.user_id = auth.uid() and rc.reward_type = 'attendance'
    ), now()),
    (
      select count(*) < 20
      from reward_claims rc
      where rc.user_id = auth.uid()
        and rc.reward_type = 'rewarded_ad'
        and rc.created_at >= date_trunc('day', now())
    )
  from users u
  where u.id = auth.uid();
$$;

create or replace function public.claim_point_reward(
  p_reward_type text,
  p_reward_key text
) returns table (
  point_balance integer,
  awarded_points integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_last timestamptz;
begin
  if p_reward_type not in ('attendance', 'rewarded_ad') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;

  if p_reward_type = 'attendance' then
    select max(created_at) into v_last
    from reward_claims
    where user_id = auth.uid() and reward_type = 'attendance';
    if v_last is not null and v_last + interval '30 minutes' > now() then
      raise exception 'REWARD_COOLDOWN';
    end if;
    v_points := 10;
  else
    if (
      select count(*) >= 20
      from reward_claims
      where user_id = auth.uid()
        and reward_type = 'rewarded_ad'
        and created_at >= date_trunc('day', now())
    ) then
      raise exception 'DAILY_REWARD_LIMIT';
    end if;
    v_points := 5;
  end if;

  insert into reward_claims(user_id, reward_type, reward_key, points)
  values (auth.uid(), p_reward_type, p_reward_key, v_points);

  insert into point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), v_points, p_reward_type, p_reward_key);

  update users
  set point_balance = point_balance + v_points, updated_at = now()
  where id = auth.uid()
  returning users.point_balance into point_balance;

  awarded_points := v_points;
  next_available_at := case when p_reward_type = 'attendance' then now() + interval '30 minutes' else now() end;
  return next;
end;
$$;

revoke all on function public.get_my_wallet() from public;
revoke all on function public.claim_point_reward(text, text) from public;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.claim_point_reward(text, text) to authenticated;
