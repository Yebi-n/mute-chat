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
      select max(rc.created_at) + interval '1 hour'
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
    if v_last is not null and v_last + interval '1 hour' > now() then
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
  next_available_at := case when p_reward_type = 'attendance' then now() + interval '1 hour' else now() end;
  return next;
end;
$$;
