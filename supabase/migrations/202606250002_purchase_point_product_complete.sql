create or replace function public.purchase_point_product(p_product_id text)
returns table(point_balance integer, product_id text, entitlement_type text, value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_entitlement_type text;
begin
  v_price := case p_product_id
    when 'mute_bubble_color_01' then 1200
    when 'mute_bubble_color_02' then 1200
    when 'mute_bubble_color_03' then 1200
    when 'mute_bubble_color_04' then 1500
    when 'mute_bubble_color_05' then 1500
    when 'mute_bubble_color_06' then 1500
    when 'mute_bubble_color_07' then 1500
    when 'mute_bubble_color_08' then 1800
    when 'mute_bubble_color_09' then 2200
    when 'mute_bubble_color_10' then 2200
    when 'mute_text_color_01' then 1800
    when 'mute_text_color_02' then 1800
    when 'mute_text_color_03' then 2500
    when 'mute_text_color_04' then 2500
    when 'mute_text_color_05' then 2500
    when 'mute_text_color_06' then 2800
    when 'mute_text_color_07' then 2800
    when 'mute_text_color_08' then 3200
    when 'mute_text_color_09' then 3200
    when 'mute_custom_bubble_color' then 3200
    when 'mute_custom_text_color' then 3200
    when 'mute_custom_background' then 3200
    else null
  end;
  if v_price is null then raise exception 'POINT_PRODUCT_NOT_SUPPORTED'; end if;

  v_entitlement_type := case
    when p_product_id like 'mute_bubble_color_%' then 'bubble_color'
    when p_product_id like 'mute_text_color_%' then 'text_color'
    when p_product_id = 'mute_custom_background' then 'background_color'
    else 'custom_color'
  end;

  update public.users app_user
  set point_balance = app_user.point_balance - v_price, updated_at = now()
  where app_user.id = auth.uid() and app_user.point_balance >= v_price
  returning app_user.point_balance into point_balance;

  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -v_price, 'point_product_purchase', p_product_id);

  insert into public.user_entitlements(user_id, product_id, entitlement_type, value, expires_at)
  values (auth.uid(), p_product_id, v_entitlement_type, p_product_id, now() + interval '7 days')
  on conflict (user_id, product_id) do update
  set entitlement_type = excluded.entitlement_type,
      value = excluded.value,
      expires_at = greatest(coalesce(public.user_entitlements.expires_at, now()), now()) + interval '7 days';

  product_id := p_product_id;
  entitlement_type := v_entitlement_type;
  value := p_product_id;
  return next;
end;
$$;

grant execute on function public.purchase_point_product(text) to authenticated;
