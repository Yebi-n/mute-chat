create or replace function public.promote_room(p_room_id uuid)
returns table(last_promoted_at timestamptz, next_available_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_result timestamptz;
  v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 0));

  if not exists (
    select 1 from public.room_memberships membership
    where membership.room_id = p_room_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role = 'owner'::public.room_role
  ) then raise exception 'OWNER_ONLY'; end if;
  if exists (
    select 1 from public.rooms room
    where room.id = p_room_id and room.category = 'adult'
  ) then raise exception 'ADULT_PROMOTION_DISABLED'; end if;

  select promotion.last_promoted_at into v_last
  from public.room_promotions promotion
  where promotion.room_id = p_room_id;

  if v_last is not null and v_last + interval '15 minutes' > now() then
    raise exception 'PROMOTION_COOLDOWN:%',
      extract(epoch from (v_last + interval '15 minutes' - now()))::integer;
  end if;

  insert into public.room_promotions(room_id, last_promoted_at, promotion_count, updated_at)
  values (p_room_id, now(), 1, now())
  on conflict (room_id) do update
  set last_promoted_at = excluded.last_promoted_at,
      promotion_count = public.room_promotions.promotion_count + 1,
      updated_at = now()
  returning public.room_promotions.last_promoted_at into v_result;

  select coalesce(nullif(trim(profile.display_name), ''), '방장') into v_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id, auth.uid(), 'system',
    coalesce(v_name, '방장') || '님이 프로모션을 돌렸습니다.'
  );

  update public.rooms room set updated_at = now() where room.id = p_room_id;

  last_promoted_at := v_result;
  next_available_at := v_result + interval '15 minutes';
  return next;
end;
$$;

revoke all on function public.promote_room(uuid) from public;
grant execute on function public.promote_room(uuid) to authenticated;
