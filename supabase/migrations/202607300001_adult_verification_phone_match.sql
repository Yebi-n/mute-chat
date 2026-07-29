create or replace function public.find_user_id_by_verified_phone(p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
stable
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_normalized text;
  v_user_id uuid;
begin
  if v_digits = '' then
    return null;
  end if;

  if left(v_digits, 2) = '82' then
    v_normalized := '+' || v_digits;
  elsif left(v_digits, 1) = '0' then
    v_normalized := '+82' || substr(v_digits, 2);
  else
    v_normalized := '+82' || v_digits;
  end if;

  select auth_user.id
    into v_user_id
  from auth.users auth_user
  join public.users app_user on app_user.id = auth_user.id
  where regexp_replace(coalesce(auth_user.phone, ''), '\D', '', 'g') = regexp_replace(v_normalized, '\D', '', 'g')
     or regexp_replace(coalesce(auth_user.raw_user_meta_data->>'phone', ''), '\D', '', 'g') = regexp_replace(v_normalized, '\D', '', 'g')
  order by auth_user.created_at desc
  limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.find_user_id_by_verified_phone(text) from public;
grant execute on function public.find_user_id_by_verified_phone(text) to service_role;
