-- Route service-role account deletion through the same cleanup used by
-- dashboard Auth deletion and in-app account deletion.
create or replace function public.prepare_account_deletion_for_user(
  p_user_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_now timestamptz := now();
begin
  if p_user_id is null then
    raise exception 'USER_ID_REQUIRED';
  end if;

  insert into public.account_deletion_requests(
    user_id, requested_at, scheduled_for, cancelled_at, completed_at
  )
  values (p_user_id, v_now, v_now, null, v_now)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = excluded.completed_at;

  perform public.cleanup_user_room_state(p_user_id);
  return v_now;
end;
$$;

revoke all on function public.prepare_account_deletion_for_user(uuid) from public;
grant execute on function public.prepare_account_deletion_for_user(uuid) to service_role;

create or replace function public.prepare_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_system_admin() then
    raise exception 'ADMIN_ACCOUNT_DELETION_FORBIDDEN';
  end if;

  return public.prepare_account_deletion_for_user(auth.uid());
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
