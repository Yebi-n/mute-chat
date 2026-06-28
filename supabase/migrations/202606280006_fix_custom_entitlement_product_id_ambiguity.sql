create or replace function public.set_custom_chat_entitlement_value(
  p_product_id text,
  p_value text
)
returns table(product_id text, entitlement_type text, value text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_entitlements%rowtype;
begin
  if p_value is null or p_value !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_COLOR';
  end if;

  if not (
    p_product_id in ('mute_custom_bubble_color', 'mute_custom_text_color', 'mute_custom_background')
    or p_product_id ~ '^mute_custom_bubble_color_[1-9]$|^mute_custom_bubble_color_10$'
    or p_product_id ~ '^mute_custom_text_color_[1-9]$|^mute_custom_text_color_10$'
    or p_product_id ~ '^mute_custom_background_[1-9]$|^mute_custom_background_10$'
  ) then
    raise exception 'POINT_PRODUCT_NOT_SUPPORTED';
  end if;

  update public.user_entitlements as entitlement
  set value = upper(p_value)
  where entitlement.user_id = auth.uid()
    and entitlement.product_id = p_product_id
    and entitlement.expires_at > now()
  returning entitlement.* into v_row;

  if not found then
    raise exception 'ENTITLEMENT_REQUIRED';
  end if;

  return query
  select
    v_row.product_id::text,
    v_row.entitlement_type::text,
    v_row.value::text,
    v_row.expires_at;
end;
$$;

grant execute on function public.set_custom_chat_entitlement_value(text, text) to authenticated;
