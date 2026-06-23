create extension if not exists pgcrypto with schema extensions;

create or replace function public.check_phone_signup_status(
  p_phone text
)
returns table (
  can_signup boolean,
  reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_phone text := lower(trim(coalesce(p_phone, '')));
  v_blocked_until timestamptz;
begin
  if v_phone = '' then
    return query select false, 'invalid_phone';
    return;
  end if;

  select blocked_until
    into v_blocked_until
  from public.account_rejoin_cooldowns
  where phone_hash = encode(extensions.digest(v_phone, 'sha256'), 'hex')
    and blocked_until > now()
  order by blocked_until desc
  limit 1;

  if v_blocked_until is not null then
    return query select false, 'cooldown';
    return;
  end if;

  if exists (
    select 1
    from auth.users
    where lower(trim(coalesce(phone, ''))) = v_phone
  ) then
    return query select false, 'exists';
    return;
  end if;

  return query select true, 'ok';
end;
$$;

revoke all on function public.check_phone_signup_status(text) from public;
grant execute on function public.check_phone_signup_status(text) to anon, authenticated;
