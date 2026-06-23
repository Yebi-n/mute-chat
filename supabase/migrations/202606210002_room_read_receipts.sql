create table if not exists public.room_read_receipts (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_message_id uuid references public.messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.room_read_receipts enable row level security;

drop policy if exists room_read_receipts_read_own on public.room_read_receipts;
create policy room_read_receipts_read_own
on public.room_read_receipts
for select to authenticated
using (user_id = auth.uid());

drop policy if exists room_read_receipts_upsert_own on public.room_read_receipts;
create policy room_read_receipts_upsert_own
on public.room_read_receipts
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_room_member(room_id)
);

drop policy if exists room_read_receipts_update_own on public.room_read_receipts;
create policy room_read_receipts_update_own
on public.room_read_receipts
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_active_room_member(room_id)
);

create or replace function public.mark_room_read(
  p_room_id uuid,
  p_last_read_message_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if p_last_read_message_id is not null and not exists (
    select 1 from public.messages
    where id = p_last_read_message_id
      and room_id = p_room_id
      and deleted_at is null
  ) then raise exception 'INVALID_MESSAGE'; end if;

  insert into public.room_read_receipts(room_id, user_id, last_read_message_id, last_read_at)
  values (p_room_id, auth.uid(), p_last_read_message_id, now())
  on conflict (room_id, user_id) do update
  set last_read_message_id = excluded.last_read_message_id,
      last_read_at = now();
end;
$$;

revoke all on function public.mark_room_read(uuid, uuid) from public;
grant execute on function public.mark_room_read(uuid, uuid) to authenticated;
