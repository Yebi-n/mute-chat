create or replace function public.claim_push_outbox(p_limit integer default 100)
returns setof public.push_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;

  return query
  with candidates as (
    select queued.id
    from public.push_outbox queued
    where queued.sent_at is null
      and queued.failed_at is null
      and (
        queued.processing_started_at is null
        or queued.processing_started_at < now() - interval '5 minutes'
      )
    order by queued.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  )
  update public.push_outbox queued
  set processing_started_at = now(),
      attempt_count = queued.attempt_count + 1
  from candidates
  where queued.id = candidates.id
  returning queued.*;
end;
$$;

revoke all on function public.claim_push_outbox(integer) from public;
grant execute on function public.claim_push_outbox(integer) to service_role;
