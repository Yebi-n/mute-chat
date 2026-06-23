create or replace function public.transfer_room_points(
  p_room_id uuid,
  p_recipient_user_id uuid,
  p_amount integer
) returns table (
  point_balance integer,
  message_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_recipient_name text;
  v_body text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'INVALID_AMOUNT'; end if;
  if p_recipient_user_id = auth.uid() then raise exception 'INVALID_RECIPIENT'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'FORBIDDEN'; end if;
  if not exists (
    select 1 from public.room_memberships
    where room_id = p_room_id
      and user_id = p_recipient_user_id
      and status = 'active'
  ) then raise exception 'INVALID_RECIPIENT'; end if;

  update public.users
  set point_balance = point_balance - p_amount,
      updated_at = now()
  where id = auth.uid()
    and point_balance >= p_amount
  returning users.point_balance into point_balance;

  if point_balance is null then raise exception 'INSUFFICIENT_POINTS'; end if;

  update public.users
  set point_balance = point_balance + p_amount,
      updated_at = now()
  where id = p_recipient_user_id;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values
    (auth.uid(), -p_amount, 'point_transfer', p_room_id::text),
    (p_recipient_user_id, p_amount, 'point_transfer', p_room_id::text);

  select coalesce(nullif(trim(display_name), ''), '나')
    into v_sender_name
  from public.room_profiles
  where room_id = p_room_id and user_id = auth.uid();

  select coalesce(nullif(trim(display_name), ''), '멤버')
    into v_recipient_name
  from public.room_profiles
  where room_id = p_room_id and user_id = p_recipient_user_id;

  v_body := coalesce(v_sender_name, '나') || '님이 ' || coalesce(v_recipient_name, '멤버') || '님에게 ' || p_amount::text || 'p를 보냈습니다.';

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, auth.uid(), 'system', v_body)
  returning id into message_id;

  update public.rooms set updated_at = now() where id = p_room_id;
  return next;
end;
$$;

revoke all on function public.transfer_room_points(uuid, uuid, integer) from public;
grant execute on function public.transfer_room_points(uuid, uuid, integer) to authenticated;
