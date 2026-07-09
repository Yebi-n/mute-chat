alter table public.users
  add column if not exists signup_completed_at timestamptz;

-- Existing real accounts already have a password. OTP-only rows created while
-- sending a signup SMS stay incomplete and must not block a later signup retry.
update public.users app_user
set signup_completed_at = coalesce(app_user.signup_completed_at, app_user.created_at, now()),
    updated_at = now()
from auth.users auth_user
where auth_user.id = app_user.id
  and app_user.signup_completed_at is null
  and coalesce(auth_user.encrypted_password, '') <> '';

create or replace function public.check_phone_signup_status(p_phone text)
returns table (can_signup boolean, reason text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_phone text := lower(trim(coalesce(p_phone, '')));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_phone = '' or v_digits = '' then
    return query select false, 'invalid_phone';
    return;
  end if;

  -- Treat OTP-only auth rows as incomplete signup. A phone number is considered
  -- registered only after password setup has completed.
  if exists (
    select 1
    from auth.users auth_user
    left join public.users app_user on app_user.id = auth_user.id
    where (
      lower(trim(coalesce(auth_user.phone, ''))) = v_phone
      or regexp_replace(coalesce(auth_user.phone, ''), '\D', '', 'g') = v_digits
      or lower(trim(coalesce(auth_user.raw_user_meta_data->>'phone', ''))) = v_phone
      or regexp_replace(coalesce(auth_user.raw_user_meta_data->>'phone', ''), '\D', '', 'g') = v_digits
    )
    and (
      coalesce(auth_user.encrypted_password, '') <> ''
      or app_user.signup_completed_at is not null
    )
  ) then
    return query select false, 'exists';
    return;
  end if;

  return query select true, 'ok';
end;
$$;

revoke all on function public.check_phone_signup_status(text) from public;
grant execute on function public.check_phone_signup_status(text) to anon, authenticated;

create or replace function public.complete_signup_compliance(
  p_privacy_version text default '1.0'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_document_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select document.id into v_document_id
  from public.legal_documents document
  where document.document_type = 'privacy'
    and document.version = p_privacy_version
    and document.is_current = true
  limit 1;

  if v_document_id is null then raise exception 'PRIVACY_DOCUMENT_NOT_FOUND'; end if;

  insert into public.user_legal_acceptances(user_id, legal_document_id, accepted_at)
  values (v_user_id, v_document_id, now())
  on conflict (user_id, legal_document_id) do nothing;

  update public.users
  set age_confirmed_at = coalesce(age_confirmed_at, now()),
      signup_completed_at = coalesce(signup_completed_at, now()),
      updated_at = now()
  where id = v_user_id;
end;
$$;

revoke all on function public.complete_signup_compliance(text) from public;
grant execute on function public.complete_signup_compliance(text) to authenticated;
