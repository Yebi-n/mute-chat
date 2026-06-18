create table if not exists public.account_rejoin_cooldowns (
  phone_hash text primary key,
  blocked_until timestamptz not null,
  requested_at timestamptz not null default now()
);

alter table public.account_rejoin_cooldowns enable row level security;
revoke all on public.account_rejoin_cooldowns from anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_phone_hash text;
begin
  if new.phone is not null and new.phone <> '' then
    v_phone_hash := encode(digest(lower(trim(new.phone)), 'sha256'), 'hex');
    if exists (
      select 1
      from public.account_rejoin_cooldowns
      where phone_hash = v_phone_hash
        and blocked_until > now()
    ) then
      raise exception 'ACCOUNT_REJOIN_COOLDOWN';
    end if;
  end if;

  insert into public.users(id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prepare_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text;
  v_blocked_until timestamptz := now() + interval '3 days';
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select phone into v_phone from auth.users where id = v_user_id;
  if v_phone is null or v_phone = '' then raise exception 'PHONE_REQUIRED'; end if;

  insert into public.account_rejoin_cooldowns(phone_hash, blocked_until, requested_at)
  values (encode(digest(lower(trim(v_phone)), 'sha256'), 'hex'), v_blocked_until, now())
  on conflict (phone_hash) do update
    set blocked_until = excluded.blocked_until,
        requested_at = excluded.requested_at;

  insert into public.account_deletion_requests(user_id, requested_at, scheduled_for, cancelled_at, completed_at)
  values (v_user_id, now(), now(), null, null)
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        scheduled_for = excluded.scheduled_for,
        cancelled_at = null,
        completed_at = null;

  delete from public.rooms where owner_user_id = v_user_id;
  delete from public.room_bans
    where banned_by_user_id = v_user_id or revoked_by_user_id = v_user_id;
  delete from public.room_audit_logs
    where actor_user_id = v_user_id or target_user_id = v_user_id;
  update public.room_join_requests
    set decided_by_user_id = null
    where decided_by_user_id = v_user_id;

  return v_blocked_until;
end;
$$;

revoke all on function public.prepare_account_deletion() from public;
grant execute on function public.prepare_account_deletion() to authenticated;
