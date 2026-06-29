create or replace function public.disable_my_push_devices()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.push_devices device
  set enabled = false,
      last_seen_at = now()
  where device.user_id = auth.uid();
end;
$$;

revoke all on function public.disable_my_push_devices() from public;
grant execute on function public.disable_my_push_devices() to authenticated;
