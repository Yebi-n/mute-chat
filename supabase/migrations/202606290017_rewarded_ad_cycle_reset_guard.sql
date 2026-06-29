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
  with latest_claims as (
    select
      max(claim.created_at) filter (where claim.reward_type = 'attendance') as attendance_claimed_at,
      max(claim.created_at) filter (where claim.reward_type = 'rewarded_ad') as ad_claimed_at
    from public.reward_claims claim
    where claim.user_id = auth.uid()
  )
  select
    app_user.point_balance,
    coalesce(latest_claims.attendance_claimed_at + interval '1 hour', now()) as attendance_available_at,
    latest_claims.ad_claimed_at is null
      or latest_claims.ad_claimed_at + interval '1 hour' <= now() as rewarded_ad_available
  from public.users app_user
  cross join latest_claims
  where app_user.id = auth.uid();
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
  v_last_claim timestamptz;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_reward_type not in ('attendance', 'rewarded_ad') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;

  select max(claim.created_at)
  into v_last_claim
  from public.reward_claims claim
  where claim.user_id = auth.uid()
    and claim.reward_type = p_reward_type;

  if v_last_claim is not null and v_last_claim + interval '1 hour' > now() then
    if p_reward_type = 'rewarded_ad' then
      raise exception 'REWARDED_AD_ALREADY_CLAIMED';
    end if;
    raise exception 'REWARD_COOLDOWN';
  end if;

  v_points := case when p_reward_type = 'attendance' then 20 else 10 end;

  insert into public.reward_claims(user_id, reward_type, reward_key, points)
  values (auth.uid(), p_reward_type, p_reward_key, v_points);

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), v_points, p_reward_type, p_reward_key);

  update public.users app_user
  set point_balance = app_user.point_balance + v_points,
      updated_at = now()
  where app_user.id = auth.uid()
  returning app_user.point_balance into point_balance;

  awarded_points := v_points;
  next_available_at := now() + interval '1 hour';
  return next;
end;
$$;

revoke all on function public.get_my_wallet() from public;
revoke all on function public.claim_point_reward(text,text) from public;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.claim_point_reward(text,text) to authenticated;
