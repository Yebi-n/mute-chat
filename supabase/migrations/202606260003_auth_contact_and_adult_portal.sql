create or replace function public.get_my_auth_contact()
returns table (
  phone text,
  email text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select auth_user.phone::text, auth_user.email::text
  from auth.users auth_user
  where auth_user.id = auth.uid();
$$;

revoke all on function public.get_my_auth_contact() from public;
grant execute on function public.get_my_auth_contact() to authenticated;
