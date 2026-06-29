create or replace function public.apply_verified_store_purchase(
  p_user_id uuid,
  p_provider text,
  p_transaction_id text,
  p_product_id text,
  p_points integer,
  p_entitlement_type text default null,
  p_entitlement_expires_at timestamptz default null,
  p_environment text default null,
  p_raw_payload jsonb default '{}'::jsonb
) returns table(point_balance integer, credited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
  v_existing_user_id uuid;
begin
  if p_provider not in ('app_store', 'play_store', 'revenuecat') then
    raise exception 'INVALID_PROVIDER';
  end if;
  if nullif(trim(p_transaction_id), '') is null then
    raise exception 'INVALID_TRANSACTION';
  end if;
  if p_points < 0 then raise exception 'INVALID_POINTS'; end if;

  insert into public.store_transactions(
    provider, transaction_id, user_id, product_id, points_awarded,
    entitlement_type, entitlement_expires_at, environment, raw_payload
  ) values (
    p_provider, trim(p_transaction_id), p_user_id, p_product_id, p_points,
    p_entitlement_type, p_entitlement_expires_at, p_environment,
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (transaction_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select transaction_row.user_id into v_existing_user_id
    from public.store_transactions transaction_row
    where transaction_row.transaction_id = trim(p_transaction_id);

    if v_existing_user_id is distinct from p_user_id then
      raise exception 'TRANSACTION_OWNED_BY_ANOTHER_ACCOUNT';
    end if;

    -- A previous app version could finish and record a transaction before its
    -- entitlement row was persisted. Re-verification may restore only the
    -- non-consumable/subscription entitlement; consumable points stay idempotent.
    if p_entitlement_type is not null then
      insert into public.user_entitlements(
        user_id, product_id, entitlement_type, value, expires_at
      ) values (
        p_user_id, p_product_id, p_entitlement_type, p_product_id,
        p_entitlement_expires_at
      )
      on conflict (user_id, product_id) do update
      set entitlement_type = excluded.entitlement_type,
          value = excluded.value,
          expires_at = excluded.expires_at;
    end if;

    select app_user.point_balance into point_balance
    from public.users app_user where app_user.id = p_user_id;
    credited := false;
    return next;
    return;
  end if;

  if p_points > 0 then
    update public.users app_user
    set point_balance = app_user.point_balance + p_points,
        updated_at = now()
    where app_user.id = p_user_id
    returning app_user.point_balance into point_balance;

    insert into public.point_ledger(user_id, amount, reason, reference_id)
    values (p_user_id, p_points, 'store_purchase', p_transaction_id);
  else
    select app_user.point_balance into point_balance
    from public.users app_user where app_user.id = p_user_id;
  end if;

  if p_entitlement_type is not null then
    insert into public.user_entitlements(
      user_id, product_id, entitlement_type, value, expires_at
    ) values (
      p_user_id, p_product_id, p_entitlement_type, p_product_id,
      p_entitlement_expires_at
    )
    on conflict (user_id, product_id) do update
    set entitlement_type = excluded.entitlement_type,
        value = excluded.value,
        expires_at = excluded.expires_at;
  end if;

  credited := true;
  return next;
end;
$$;

revoke all on function public.apply_verified_store_purchase(
  uuid, text, text, text, integer, text, timestamptz, text, jsonb
) from public;
grant execute on function public.apply_verified_store_purchase(
  uuid, text, text, text, integer, text, timestamptz, text, jsonb
) to service_role;
