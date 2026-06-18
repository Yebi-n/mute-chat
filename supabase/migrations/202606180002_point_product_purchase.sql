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

  update public.users
  set point_balance = point_balance - v_price,
      updated_at = now()
  where id = auth.uid()
    and point_balance >= v_price
  returning users.point_balance into point_balance;

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

revoke all on function public.purchase_point_product(text) from public;
grant execute on function public.purchase_point_product(text) to authenticated;
