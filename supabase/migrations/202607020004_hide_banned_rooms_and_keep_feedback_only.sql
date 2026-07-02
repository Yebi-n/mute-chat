create or replace function public.list_reported_room_ids()
returns table(room_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select distinct room_id
  from (
    select report.target_id::uuid as room_id
    from public.reports report
    where report.reporter_user_id = auth.uid()
      and report.target_type = 'room'
      and report.target_id::text ~ '^[0-9a-fA-F-]{36}$'
    union
    select ban.room_id
    from public.room_bans ban
    where ban.user_id = auth.uid()
      and ban.revoked_at is null
  ) hidden_rooms;
$$;

revoke all on function public.list_reported_room_ids() from public;
grant execute on function public.list_reported_room_ids() to authenticated;

do $$
declare
  v_feedback_room_id uuid;
begin
  select room.id
  into v_feedback_room_id
  from public.rooms room
  where room.deleted_at is null
    and room.name in (
      U&'\D53C\B4DC\BC31 \BC29',
      U&'\005B\D53C\B4DC\BC31 \BC29\005D'
    )
  order by room.created_at desc
  limit 1;

  if v_feedback_room_id is null then
    raise exception 'FEEDBACK_ROOM_NOT_FOUND';
  end if;

  update public.rooms room
  set deleted_at = now(),
      updated_at = now()
  where room.deleted_at is null
    and room.id <> v_feedback_room_id;

  delete from public.room_promotions promotion
  where promotion.room_id <> v_feedback_room_id;

  delete from public.room_top_spaces top_space
  where top_space.room_id <> v_feedback_room_id;
end
$$;
