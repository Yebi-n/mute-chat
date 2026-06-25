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
  with last_attendance as (
    select max(claim.created_at) as claimed_at
    from public.reward_claims claim
    where claim.user_id = auth.uid()
      and claim.reward_type = 'attendance'
  )
  select
    app_user.point_balance,
    coalesce(last_attendance.claimed_at + interval '1 hour', now()),
    (
      last_attendance.claimed_at is not null
      and last_attendance.claimed_at + interval '1 hour' > now()
      and not exists (
        select 1
        from public.reward_claims claim
        where claim.user_id = auth.uid()
          and claim.reward_type = 'rewarded_ad'
          and claim.created_at >= last_attendance.claimed_at
      )
    ) as rewarded_ad_available
  from public.users app_user
  cross join last_attendance
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
  v_last_attendance timestamptz;
begin
  if p_reward_type not in ('attendance', 'rewarded_ad') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;

  select max(claim.created_at) into v_last_attendance
  from public.reward_claims claim
  where claim.user_id = auth.uid()
    and claim.reward_type = 'attendance';

  if p_reward_type = 'attendance' then
    if v_last_attendance is not null and v_last_attendance + interval '1 hour' > now() then
      raise exception 'REWARD_COOLDOWN';
    end if;
    v_points := 20;
  else
    if v_last_attendance is null or v_last_attendance + interval '1 hour' <= now() then
      raise exception 'REWARDED_AD_ATTENDANCE_REQUIRED';
    end if;
    if exists (
      select 1
      from public.reward_claims claim
      where claim.user_id = auth.uid()
        and claim.reward_type = 'rewarded_ad'
        and claim.created_at >= v_last_attendance
    ) then
      raise exception 'REWARDED_AD_ALREADY_CLAIMED';
    end if;
    v_points := 10;
  end if;

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
  next_available_at := case
    when p_reward_type = 'attendance' then now() + interval '1 hour'
    else coalesce(v_last_attendance + interval '1 hour', now())
  end;
  return next;
end;
$$;

delete from public.store_transactions
where transaction_id in (
  'dummy-admin-bravo-points-20260625',
  'dummy-admin-bravo-adfree-20260625'
);

revoke all on function public.get_my_wallet() from public;
revoke all on function public.claim_point_reward(text,text) from public;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.claim_point_reward(text,text) to authenticated;
