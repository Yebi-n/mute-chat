create table if not exists public.room_point_transfers (
  sender_user_id uuid not null references public.users(id) on delete cascade,
  request_id text not null check (char_length(request_id) between 12 and 120),
  room_id uuid not null references public.rooms(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  sender_balance_after integer,
  message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (sender_user_id, request_id)
);

create index if not exists room_point_transfers_sender_created
  on public.room_point_transfers(sender_user_id, created_at desc);

alter table public.room_point_transfers enable row level security;

create or replace function public.transfer_room_points(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_amount integer,
  p_request_id text
) returns table (point_balance integer, message_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_name text;
  v_recipient_name text;
  v_body text;
  v_claimed integer := 0;
  v_locked_id uuid;
  v_locked_count integer := 0;
  v_sender_balance integer;
  v_message_id uuid;
  v_existing public.room_point_transfers%rowtype;
begin
  if v_sender_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null or char_length(trim(p_request_id)) not between 12 and 120 then
    raise exception 'POINT_TRANSFER_REQUEST_INVALID';
  end if;
  if p_amount is null or p_amount < 1 then
    raise exception 'POINT_TRANSFER_AMOUNT_INVALID';
  end if;
  if p_recipient_user_id is null or p_recipient_user_id = v_sender_id then
    raise exception 'POINT_TRANSFER_RECIPIENT_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  if not public.is_active_room_member(p_room_id) then
    raise exception 'POINT_TRANSFER_MEMBER_REQUIRED';
  end if;
  if not exists (
    select 1 from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = p_recipient_user_id
      and membership.status = 'active'
  ) then
    raise exception 'POINT_TRANSFER_RECIPIENT_INVALID';
  end if;

  insert into public.room_point_transfers(
    sender_user_id, request_id, room_id, recipient_user_id, amount
  ) values (
    v_sender_id, trim(p_request_id), p_room_id, p_recipient_user_id, p_amount
  )
  on conflict (sender_user_id, request_id) do nothing;
  get diagnostics v_claimed = row_count;

  if v_claimed = 0 then
    select transfer.* into v_existing
    from public.room_point_transfers transfer
    where transfer.sender_user_id = v_sender_id
      and transfer.request_id = trim(p_request_id);
    if v_existing.room_id is distinct from p_room_id
      or v_existing.recipient_user_id is distinct from p_recipient_user_id
      or v_existing.amount is distinct from p_amount then
      raise exception 'POINT_TRANSFER_IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.message_id is null or v_existing.sender_balance_after is null then
      raise exception 'POINT_TRANSFER_INCOMPLETE';
    end if;
    return query select v_existing.sender_balance_after, v_existing.message_id;
    return;
  end if;

  -- Lock wallets in UUID order to prevent opposite-direction transfer deadlocks.
  for v_locked_id in
    select account.id from public.users account
    where account.id in (v_sender_id, p_recipient_user_id)
    order by account.id
    for update
  loop
    v_locked_count := v_locked_count + 1;
  end loop;
  if v_locked_count <> 2 then raise exception 'POINT_TRANSFER_RECIPIENT_INVALID'; end if;

  select account.point_balance into v_sender_balance
  from public.users account where account.id = v_sender_id;
  if v_sender_balance < p_amount then raise exception 'INSUFFICIENT_POINTS'; end if;

  update public.users account
  set point_balance = account.point_balance - p_amount, updated_at = now()
  where account.id = v_sender_id
  returning account.point_balance into v_sender_balance;

  update public.users account
  set point_balance = account.point_balance + p_amount, updated_at = now()
  where account.id = p_recipient_user_id;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values
    (v_sender_id, -p_amount, 'point_transfer', trim(p_request_id)),
    (p_recipient_user_id, p_amount, 'point_transfer', trim(p_request_id));

  select coalesce(nullif(trim(profile.display_name), ''), '나') into v_sender_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = v_sender_id;

  select coalesce(nullif(trim(profile.display_name), ''), '멤버') into v_recipient_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = p_recipient_user_id;

  v_body := coalesce(v_sender_name, '나') || '님이 '
    || coalesce(v_recipient_name, '멤버') || '님에게 '
    || p_amount::text || 'p를 보냈습니다.';

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, v_sender_id, 'system', v_body)
  returning id into v_message_id;

  update public.room_point_transfers transfer
  set sender_balance_after = v_sender_balance,
      message_id = v_message_id,
      completed_at = now()
  where transfer.sender_user_id = v_sender_id
    and transfer.request_id = trim(p_request_id);

  update public.rooms room set updated_at = now() where room.id = p_room_id;

  return query select v_sender_balance, v_message_id;
end;
$$;

revoke all on function public.transfer_room_points(uuid, uuid, integer, text) from public;
grant execute on function public.transfer_room_points(uuid, uuid, integer, text) to authenticated;

-- Keep installed older clients functional while routing them through ordered locks.
create or replace function public.transfer_room_points(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_amount integer
) returns table (point_balance integer, message_id uuid)
language sql
security definer
set search_path = public
as $$
  select transfer.point_balance, transfer.message_id
  from public.transfer_room_points(
    p_room_id,
    p_recipient_user_id,
    p_amount,
    'legacy-' || gen_random_uuid()::text
  ) transfer;
$$;

revoke all on function public.transfer_room_points(uuid, uuid, integer) from public;
grant execute on function public.transfer_room_points(uuid, uuid, integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.point_ledger;
exception when duplicate_object then null;
end $$;
