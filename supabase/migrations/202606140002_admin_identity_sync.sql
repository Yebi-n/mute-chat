create or replace function public.sync_auth_super_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_super_admin :=
    coalesce((new.raw_app_meta_data ->> 'is_super_admin')::boolean, false)
    and new.raw_app_meta_data ->> 'admin_role' = 'super_admin';
  return new;
end;
$$;

drop trigger if exists sync_auth_super_admin on auth.users;
create trigger sync_auth_super_admin
before insert or update of raw_app_meta_data
on auth.users
for each row
execute function public.sync_auth_super_admin();

update auth.users
set
  is_super_admin = false,
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    - 'is_super_admin'
    - 'admin_role'
where right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 4) = '6376';
