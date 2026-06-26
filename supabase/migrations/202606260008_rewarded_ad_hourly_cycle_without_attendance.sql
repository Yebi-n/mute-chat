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
  ),
  cycle as (
    select
      coalesce(claimed_at + interval '1 hour', now()) as attendance_at,
      case
        when claimed_at is null then date_trunc('hour', now())
        when claimed_at + interval '1 hour' <= now() then claimed_at + interval '1 hour'
        else claimed_at
      end as ad_cycle_start
    from last_attendance
  )
  select
    app_user.point_balance,
    cycle.attendance_at,
    not exists (
      select 1
      from public.reward_claims claim
      where claim.user_id = auth.uid()
        and claim.reward_type = 'rewarded_ad'
        and claim.created_at >= cycle.ad_cycle_start
    ) as rewarded_ad_available
  from public.users app_user
  cross join cycle
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
  v_ad_cycle_start timestamptz;
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
    v_ad_cycle_start := case
      when v_last_attendance is null then date_trunc('hour', now())
      when v_last_attendance + interval '1 hour' <= now() then v_last_attendance + interval '1 hour'
      else v_last_attendance
    end;
    if exists (
      select 1
      from public.reward_claims claim
      where claim.user_id = auth.uid()
        and claim.reward_type = 'rewarded_ad'
        and claim.created_at >= v_ad_cycle_start
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
    else coalesce(v_last_attendance + interval '1 hour', date_trunc('hour', now()) + interval '1 hour')
  end;
  return next;
end;
$$;

revoke all on function public.get_my_wallet() from public;
revoke all on function public.claim_point_reward(text,text) from public;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.claim_point_reward(text,text) to authenticated;
