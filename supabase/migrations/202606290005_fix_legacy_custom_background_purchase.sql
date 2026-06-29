create or replace function public.purchase_custom_background()
returns table(
  point_balance integer,
  product_id text,
  entitlement_type text,
  value text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  update public.users account
  set point_balance = account.point_balance - 3200,
      updated_at = now()
  where account.id = auth.uid()
    and account.point_balance >= 3200
  returning account.point_balance into v_balance;

  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values(auth.uid(), -3200, 'point_product_purchase', 'mute_custom_background');

  insert into public.user_entitlements(
    user_id,
    product_id,
    entitlement_type,
    value
  ) values (
    auth.uid(),
    'mute_custom_background',
    'background_color',
    'mute_custom_background'
  )
  on conflict on constraint user_entitlements_pkey do update
  set entitlement_type = excluded.entitlement_type,
      value = excluded.value;

  return query
  select
    v_balance,
    entitlement.product_id,
    entitlement.entitlement_type,
    entitlement.value,
    entitlement.expires_at
  from public.user_entitlements entitlement
  where entitlement.user_id = auth.uid()
    and entitlement.product_id = 'mute_custom_background';
end;
$$;

revoke all on function public.purchase_custom_background() from public;
grant execute on function public.purchase_custom_background() to authenticated;
