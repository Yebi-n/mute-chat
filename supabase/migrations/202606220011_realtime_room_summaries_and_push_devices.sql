create or replace function public.register_push_device(
  p_platform text,
  p_push_token text,
  p_enabled boolean default true
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'INVALID_PLATFORM'; end if;
  if nullif(trim(p_push_token), '') is null then raise exception 'INVALID_PUSH_TOKEN'; end if;

  insert into public.push_devices(user_id, platform, push_token, enabled, last_seen_at)
  values (auth.uid(), p_platform, trim(p_push_token), p_enabled, now())
  on conflict (push_token) do update
  set user_id = auth.uid(),
      platform = excluded.platform,
      enabled = excluded.enabled,
      last_seen_at = now();
end;
$$;

revoke all on function public.register_push_device(text, text, boolean) from public;
grant execute on function public.register_push_device(text, text, boolean) to authenticated;

create or replace function public.get_my_room_summaries()
returns table (
  room_id uuid,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    membership.room_id,
    case
      when latest.story_id is not null then '스토리를 올렸습니다.'
      when latest.kind = 'image'::public.message_kind then '사진을 보냈습니다.'
      when latest.kind = 'secret'::public.message_kind then '비밀 쪽지가 도착했습니다.'
      else nullif(trim(latest.body), '')
    end as last_message,
    latest.created_at as last_message_at,
    coalesce(unread.count, 0)::bigint as unread_count
  from public.room_memberships membership
  left join public.room_read_receipts receipt
    on receipt.room_id = membership.room_id
   and receipt.user_id = membership.user_id
  left join lateral (
    select message.kind, message.body, message.story_id, message.created_at
    from public.messages message
    where message.room_id = membership.room_id
      and message.deleted_at is null
      and (
        message.kind <> 'secret'::public.message_kind
        or message.sender_user_id = auth.uid()
        or message.secret_recipient_user_id = auth.uid()
        or public.is_system_admin()
      )
    order by message.created_at desc, message.id desc
    limit 1
  ) latest on true
  left join lateral (
    select count(*)
    from public.messages message
    where message.room_id = membership.room_id
      and message.deleted_at is null
      and message.created_at > coalesce(receipt.last_read_at, membership.joined_at, now())
      and (message.sender_user_id is null or message.sender_user_id <> auth.uid())
      and (
        message.kind <> 'secret'::public.message_kind
        or message.secret_recipient_user_id = auth.uid()
        or public.is_system_admin()
      )
  ) unread on true
  where membership.user_id = auth.uid()
    and membership.status = 'active';
$$;

revoke all on function public.get_my_room_summaries() from public;
grant execute on function public.get_my_room_summaries() to authenticated;

create or replace function public.promote_room(p_room_id uuid)
returns table(last_promoted_at timestamptz, next_available_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last timestamptz;
  v_name text;
begin
  if not exists (
    select 1 from public.room_memberships
    where room_id = p_room_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  ) then raise exception 'OWNER_ONLY'; end if;
  if exists (select 1 from public.rooms where id = p_room_id and category = 'adult')
    then raise exception 'ADULT_PROMOTION_DISABLED'; end if;

  select promotion.last_promoted_at into v_last
  from public.room_promotions promotion
  where promotion.room_id = p_room_id
  for update;
  if v_last is not null and v_last + interval '15 minutes' > now() then
    raise exception 'PROMOTION_COOLDOWN:%',
      extract(epoch from (v_last + interval '15 minutes' - now()))::integer;
  end if;

  insert into public.room_promotions(room_id, last_promoted_at, promotion_count, updated_at)
  values (p_room_id, now(), 1, now())
  on conflict (room_id) do update
  set last_promoted_at = now(),
      promotion_count = public.room_promotions.promotion_count + 1,
      updated_at = now()
  returning public.room_promotions.last_promoted_at into last_promoted_at;

  select coalesce(nullif(trim(profile.display_name), ''), '방장') into v_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = auth.uid();

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    auth.uid(),
    'system',
    coalesce(v_name, '방장') || '님이 프로모션을 돌렸습니다.'
  );
  update public.rooms set updated_at = now() where id = p_room_id;
  next_available_at := last_promoted_at + interval '15 minutes';
  return next;
end;
$$;

revoke all on function public.promote_room(uuid) from public;
grant execute on function public.promote_room(uuid) to authenticated;

delete from public.push_outbox queued
using public.messages message
where queued.data ->> 'messageId' = message.id::text
  and queued.recipient_user_id = message.sender_user_id
  and queued.sent_at is null;

delete from public.user_notifications notice
using public.messages message
where notice.data ->> 'messageId' = message.id::text
  and notice.recipient_user_id = message.sender_user_id;

do $$ begin
  alter publication supabase_realtime add table public.room_read_receipts;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.user_notifications;
exception when duplicate_object then null;
end $$;
