create table public.room_pin_attempts (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index room_pin_attempts_limit
  on public.room_pin_attempts(room_id, user_id, created_at desc);

alter table public.room_pin_attempts enable row level security;

create policy push_devices_insert_self on public.push_devices
  for insert with check (user_id = auth.uid());
create policy push_devices_update_self on public.push_devices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_devices_delete_self on public.push_devices
  for delete using (user_id = auth.uid());

create or replace function public.verify_room_pin(p_room_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_success boolean := false;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if (
    select count(*) >= 5
    from room_pin_attempts
    where room_id = p_room_id
      and user_id = auth.uid()
      and created_at > now() - interval '10 minutes'
      and succeeded = false
  ) then raise exception 'PIN_RATE_LIMITED'; end if;
  if p_pin !~ '^[0-9]{6}$' then return false; end if;

  select pin_hash into v_hash from rooms
  where id = p_room_id and visibility = 'private' and deleted_at is null;
  v_success := v_hash is not null and crypt(p_pin, v_hash) = v_hash;

  insert into room_pin_attempts(room_id, user_id, succeeded)
  values (p_room_id, auth.uid(), v_success);
  if not v_success then return false; end if;

  insert into room_pin_grants(room_id, user_id, granted_at, expires_at)
  values (p_room_id, auth.uid(), now(), now() + interval '30 minutes')
  on conflict (room_id, user_id) do update
    set granted_at = now(), expires_at = excluded.expires_at;
  return true;
end;
$$;
