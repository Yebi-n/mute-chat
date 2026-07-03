create or replace function public.expire_my_chat_entitlement(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_product_id is null or not (
    p_product_id ~ '^mute_custom_bubble_color_([1-9]|10)$'
    or p_product_id ~ '^mute_custom_text_color_([1-9]|10)$'
    or p_product_id ~ '^mute_custom_background_([1-9]|10)$'
  ) then
    raise exception 'CUSTOM_ENTITLEMENT_REQUIRED';
  end if;

  update public.user_entitlements
  set expires_at = now()
  where user_id = auth.uid()
    and product_id = p_product_id
    and expires_at > now();

  update public.room_member_chat_styles
  set
    bubble_product_id = null,
    bubble_color = '#F5F5F5',
    updated_at = now()
  where user_id = auth.uid()
    and bubble_product_id = p_product_id;

  update public.room_member_chat_styles
  set
    text_product_id = null,
    text_color = '#1C1C1C',
    updated_at = now()
  where user_id = auth.uid()
    and text_product_id = p_product_id;

  update public.room_member_chat_styles
  set
    background_product_id = null,
    background_color = '#FFFFFF',
    updated_at = now()
  where user_id = auth.uid()
    and background_product_id = p_product_id;
end;
$$;

grant execute on function public.expire_my_chat_entitlement(text) to authenticated;
