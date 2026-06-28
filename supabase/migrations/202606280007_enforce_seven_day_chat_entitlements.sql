create or replace function public.set_chat_entitlement_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base timestamptz;
begin
  if new.entitlement_type in ('bubble_color','text_color','custom_color','background_color') then
    v_base := greatest(coalesce(new.created_at, now()), now());
    if tg_op = 'UPDATE' and old.expires_at is not null and new.expires_at = old.expires_at then
      new.expires_at := old.expires_at;
    else
      new.expires_at := least(coalesce(new.expires_at, v_base + interval '7 days'), v_base + interval '7 days');
    end if;
  end if;
  return new;
end;
$$;

update public.user_entitlements
set expires_at = least(expires_at, coalesce(created_at, now()) + interval '7 days')
where entitlement_type in ('bubble_color','text_color','custom_color','background_color')
  and expires_at is not null
  and expires_at > coalesce(created_at, now()) + interval '7 days';

create or replace function public.purchase_point_product(p_product_id text)
returns table(point_balance integer, product_id text, entitlement_type text, value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_entitlement_type text;
  v_point_balance integer;
begin
  v_price := case
    when p_product_id like 'mute_bubble_color_%' then case p_product_id
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
      else null
    end
    when p_product_id like 'mute_text_color_%' then case p_product_id
      when 'mute_text_color_01' then 1800
      when 'mute_text_color_02' then 1800
      when 'mute_text_color_03' then 2500
      when 'mute_text_color_04' then 2500
      when 'mute_text_color_05' then 2500
      when 'mute_text_color_06' then 2800
      when 'mute_text_color_07' then 2800
      when 'mute_text_color_08' then 3200
      when 'mute_text_color_09' then 3200
      else null
    end
    when p_product_id in ('mute_custom_bubble_color', 'mute_custom_text_color', 'mute_custom_background') then 3200
    when p_product_id ~ '^mute_custom_bubble_color_[1-9]$|^mute_custom_bubble_color_10$' then 3200
    when p_product_id ~ '^mute_custom_text_color_[1-9]$|^mute_custom_text_color_10$' then 3200
    when p_product_id ~ '^mute_custom_background_[1-9]$|^mute_custom_background_10$' then 3200
    else null
  end;

  if v_price is null then
    raise exception 'POINT_PRODUCT_NOT_SUPPORTED';
  end if;

  v_entitlement_type := case
    when p_product_id like 'mute_bubble_color_%' then 'bubble_color'
    when p_product_id like 'mute_text_color_%' then 'text_color'
    when p_product_id like 'mute_custom_background%' then 'background_color'
    else 'custom_color'
  end;

  update public.users app_user
  set point_balance = app_user.point_balance - v_price,
      updated_at = now()
  where app_user.id = auth.uid()
    and app_user.point_balance >= v_price
  returning app_user.point_balance into v_point_balance;

  if not found then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -v_price, 'point_product_purchase', p_product_id);

  insert into public.user_entitlements(user_id, product_id, entitlement_type, value, expires_at, created_at)
  values (
    auth.uid(),
    p_product_id,
    v_entitlement_type,
    case
      when p_product_id like 'mute_custom_%' then null
      else p_product_id
    end,
    now() + interval '7 days',
    now()
  )
  on conflict on constraint user_entitlements_pkey do update
  set entitlement_type = excluded.entitlement_type,
      value = coalesce(excluded.value, public.user_entitlements.value),
      created_at = now(),
      expires_at = now() + interval '7 days';

  return query
  select v_point_balance, p_product_id, v_entitlement_type, p_product_id;
end;
$$;
