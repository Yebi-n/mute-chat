alter table public.users
  add column if not exists age_confirmed_at timestamptz;

update public.legal_documents
set is_current = false
where document_type = 'privacy';

insert into public.legal_documents(
  document_type,
  version,
  published_at,
  url,
  is_current
)
values (
  'privacy',
  '1.0',
  '2026-06-29 00:00:00+09'::timestamptz,
  'https://service-introduction-theta.vercel.app/privacy/',
  true
)
on conflict (document_type, version) do update
set published_at = excluded.published_at,
    url = excluded.url,
    is_current = true;

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
      updated_at = now()
  where id = v_user_id;
end;
$$;

revoke all on function public.complete_signup_compliance(text) from public;
grant execute on function public.complete_signup_compliance(text) to authenticated;
