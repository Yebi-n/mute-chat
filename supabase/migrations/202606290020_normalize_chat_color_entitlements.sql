create or replace function public.set_chat_entitlement_expiry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_base timestamptz;
begin
  if new.product_id like 'mute_custom_bubble_color%' then
    new.entitlement_type := 'bubble_color';
  elsif new.product_id like 'mute_custom_text_color%' then
    new.entitlement_type := 'text_color';
  elsif new.product_id like 'mute_custom_background%' then
    new.entitlement_type := 'background_color';
  end if;

  if new.entitlement_type in (
    'bubble_color', 'text_color', 'custom_color', 'background_color'
  ) then
    v_base := greatest(coalesce(new.created_at, now()), now());
    if tg_op = 'UPDATE'
       and old.expires_at is not null
       and new.expires_at = old.expires_at then
      new.expires_at := old.expires_at;
    else
      new.expires_at := least(
        coalesce(new.expires_at, v_base + interval '7 days'),
        v_base + interval '7 days'
      );
    end if;
  end if;
  return new;
end;
$$;

update public.user_entitlements entitlement
set entitlement_type = case
  when entitlement.product_id like 'mute_custom_bubble_color%' then 'bubble_color'
  when entitlement.product_id like 'mute_custom_text_color%' then 'text_color'
  when entitlement.product_id like 'mute_custom_background%' then 'background_color'
  else entitlement.entitlement_type
end
where entitlement.product_id like 'mute_custom_bubble_color%'
   or entitlement.product_id like 'mute_custom_text_color%'
   or entitlement.product_id like 'mute_custom_background%';
