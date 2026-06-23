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
    from public.reward_claims
    where user_id = auth.uid() and reward_type = 'attendance';
    if v_last is not null and v_last + interval '1 hour' > now() then
      raise exception 'REWARD_COOLDOWN';
    end if;
    v_points := 10;
  else
    if (
      select count(*) >= 20
      from public.reward_claims
      where user_id = auth.uid()
        and reward_type = 'rewarded_ad'
        and created_at >= date_trunc('day', now())
    ) then
      raise exception 'DAILY_REWARD_LIMIT';
    end if;
    v_points := 5;
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
  next_available_at := case when p_reward_type = 'attendance' then now() + interval '1 hour' else now() end;
  return next;
end;
$$;

create or replace function public.purchase_point_product(
  p_product_id text
)
returns table (
  point_balance integer,
  product_id text,
  entitlement_type text,
  value text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_entitlement_type text;
  v_value text;
begin
  v_price := case p_product_id
    when 'mute_bubble_color_01' then 1200
    when 'mute_bubble_color_02' then 1200
    when 'mute_bubble_color_03' then 1200
    when 'mute_bubble_color_04' then 1500
    when 'mute_bubble_color_05' then 1500
    when 'mute_bubble_color_06' then 1500
    when 'mute_bubble_color_07' then 1800
    when 'mute_bubble_color_08' then 1800
    when 'mute_bubble_color_09' then 1800
    when 'mute_bubble_color_10' then 2200
    when 'mute_bubble_color_11' then 2200
    when 'mute_bubble_color_12' then 2500
    when 'mute_bubble_color_13' then 2500
    when 'mute_bubble_color_14' then 2800
    when 'mute_bubble_color_15' then 3200
    when 'mute_text_color_01' then 1200
    when 'mute_text_color_02' then 1200
    when 'mute_text_color_03' then 1200
    when 'mute_text_color_04' then 1500
    when 'mute_text_color_05' then 1500
    when 'mute_text_color_06' then 1500
    when 'mute_text_color_07' then 1800
    when 'mute_text_color_08' then 1800
    when 'mute_text_color_09' then 1800
    when 'mute_text_color_10' then 2200
    when 'mute_text_color_11' then 2200
    when 'mute_text_color_12' then 2500
    when 'mute_text_color_13' then 2500
    when 'mute_text_color_14' then 2800
    when 'mute_text_color_15' then 3200
    when 'mute_custom_bubble_color' then 3200
    when 'mute_custom_text_color' then 3200
    else null
  end;

  if v_price is null then
    raise exception 'POINT_PRODUCT_NOT_SUPPORTED';
  end if;

  v_entitlement_type := case
    when p_product_id like 'mute_bubble_color_%' then 'bubble_color'
    when p_product_id like 'mute_text_color_%' then 'text_color'
    else 'custom_color'
  end;
  v_value := p_product_id;

  update public.users app_user
  set point_balance = app_user.point_balance - v_price,
      updated_at = now()
  where app_user.id = auth.uid()
    and app_user.point_balance >= v_price
  returning app_user.point_balance into point_balance;

  if not found then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -v_price, 'point_product_purchase', p_product_id);

  insert into public.user_entitlements(user_id, product_id, entitlement_type, value)
  values (auth.uid(), p_product_id, v_entitlement_type, v_value)
  on conflict (user_id, product_id) do update
    set entitlement_type = excluded.entitlement_type,
        value = excluded.value;

  product_id := p_product_id;
  entitlement_type := v_entitlement_type;
  value := v_value;
  return next;
end;
$$;

grant execute on function public.claim_point_reward(text, text) to authenticated;
grant execute on function public.purchase_point_product(text) to authenticated;
