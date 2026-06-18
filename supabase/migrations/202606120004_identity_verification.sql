alter table public.users
  add column if not exists identity_verified_at timestamptz,
  add column if not exists identity_provider text,
  add column if not exists ci_hash text;

create unique index if not exists users_ci_hash_unique
  on public.users(ci_hash)
  where ci_hash is not null;

create or replace function public.get_my_verification_status()
returns table (
  identity_verified boolean,
  adult_verified boolean,
  identity_provider text
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    identity_verified_at is not null,
    adult_verified_at is not null,
    users.identity_provider
  from public.users
  where id = auth.uid();
$$;

grant execute on function public.get_my_verification_status() to authenticated;

comment on column public.users.ci_hash is
  'Server-side HMAC of the identity provider CI. Never store raw CI.';
comment on column public.users.adult_verified_at is
  'Set only by a trusted identity-verification callback after age validation.';
