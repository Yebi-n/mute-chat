drop function if exists public.get_my_verification_status();

create or replace function public.get_my_verification_status()
returns table (
  identity_verified boolean,
  adult_verified boolean,
  identity_provider text,
  adult_content_web_opted_in boolean,
  ios_adult_content_enabled boolean
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    identity_verified_at is not null,
    adult_verified_at is not null,
    users.identity_provider,
    adult_content_web_opt_in_at is not null,
    users.ios_adult_content_enabled
  from public.users
  where id = auth.uid();
$$;

grant execute on function public.get_my_verification_status() to authenticated;
