do $$
declare
  v_target_users uuid[];
begin
  select coalesce(array_agg(id), array[]::uuid[]) into v_target_users
  from auth.users
  where email in (
    'admin-alpha@admin.mute.app',
    'admin-bravo@admin.mute.app',
    'admin-charlie@admin.mute.app',
    'test-alpha@user.mute.app',
    'test-bravo@user.mute.app'
  )
     or email like '%@admin.mute.app'
     or email like '%@user.mute.app';

  delete from public.store_transactions
  where user_id = any(v_target_users);

  delete from public.user_entitlements
  where user_id = any(v_target_users)
    and entitlement_type in ('app_theme', 'ad_free');

  delete from public.point_ledger
  where user_id = any(v_target_users)
    and reason = 'store_purchase';
end
$$;
