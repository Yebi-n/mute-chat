alter table public.messages
  add column if not exists sender_deleted_at timestamptz;

create or replace function public.purchase_point_product(p_product_id text)
returns table(point_balance integer, product_id text, entitlement_type text, value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_entitlement_type text;
  v_point_balance integer;
begin
  v_price := case
    when p_product_id like 'mute_bubble_color_%' then case p_product_id
      when 'mute_bubble_color_01' then 1200
      when 'mute_bubble_color_02' then 1200
      when 'mute_bubble_color_03' then 1200
      when 'mute_bubble_color_04' then 1500
      when 'mute_bubble_color_05' then 1500
      when 'mute_bubble_color_06' then 1500
      when 'mute_bubble_color_07' then 1500
      when 'mute_bubble_color_08' then 1800
      when 'mute_bubble_color_09' then 2200
      when 'mute_bubble_color_10' then 2200
      else null
    end
    when p_product_id like 'mute_text_color_%' then case p_product_id
      when 'mute_text_color_01' then 1800
      when 'mute_text_color_02' then 1800
      when 'mute_text_color_03' then 2500
      when 'mute_text_color_04' then 2500
      when 'mute_text_color_05' then 2500
      when 'mute_text_color_06' then 2800
      when 'mute_text_color_07' then 2800
      when 'mute_text_color_08' then 3200
      when 'mute_text_color_09' then 3200
      else null
    end
    when p_product_id in ('mute_custom_bubble_color', 'mute_custom_text_color', 'mute_custom_background') then 3200
    when p_product_id ~ '^mute_custom_bubble_color_[1-9]$|^mute_custom_bubble_color_10$' then 3200
    when p_product_id ~ '^mute_custom_text_color_[1-9]$|^mute_custom_text_color_10$' then 3200
    when p_product_id ~ '^mute_custom_background_[1-9]$|^mute_custom_background_10$' then 3200
    else null
  end;

  if v_price is null then
    raise exception 'POINT_PRODUCT_NOT_SUPPORTED';
  end if;

  v_entitlement_type := case
    when p_product_id like 'mute_bubble_color_%' then 'bubble_color'
    when p_product_id like 'mute_text_color_%' then 'text_color'
    when p_product_id like 'mute_custom_background%' then 'background_color'
    else 'custom_color'
  end;

  update public.users app_user
  set point_balance = app_user.point_balance - v_price,
      updated_at = now()
  where app_user.id = auth.uid()
    and app_user.point_balance >= v_price
  returning app_user.point_balance into v_point_balance;

  if not found then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -v_price, 'point_product_purchase', p_product_id);

  insert into public.user_entitlements(user_id, product_id, entitlement_type, value, expires_at)
  values (
    auth.uid(),
    p_product_id,
    v_entitlement_type,
    case
      when p_product_id like 'mute_custom_%' then null
      else p_product_id
    end,
    now() + interval '7 days'
  )
  on conflict on constraint user_entitlements_pkey do update
  set entitlement_type = excluded.entitlement_type,
      value = coalesce(excluded.value, public.user_entitlements.value),
      expires_at = greatest(coalesce(public.user_entitlements.expires_at, now()), now()) + interval '7 days';

  return query
  select v_point_balance, p_product_id, v_entitlement_type, p_product_id;
end;
$$;

create or replace function public.set_custom_chat_entitlement_value(
  p_product_id text,
  p_value text
)
returns table(product_id text, entitlement_type text, value text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.user_entitlements%rowtype;
begin
  if p_value is null or p_value !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'INVALID_COLOR';
  end if;

  if not (
    p_product_id in ('mute_custom_bubble_color', 'mute_custom_text_color', 'mute_custom_background')
    or p_product_id ~ '^mute_custom_bubble_color_[1-9]$|^mute_custom_bubble_color_10$'
    or p_product_id ~ '^mute_custom_text_color_[1-9]$|^mute_custom_text_color_10$'
    or p_product_id ~ '^mute_custom_background_[1-9]$|^mute_custom_background_10$'
  ) then
    raise exception 'POINT_PRODUCT_NOT_SUPPORTED';
  end if;

  update public.user_entitlements
  set value = upper(p_value)
  where user_id = auth.uid()
    and product_id = p_product_id
    and expires_at > now()
  returning * into v_row;

  if not found then
    raise exception 'ENTITLEMENT_REQUIRED';
  end if;

  return query
  select v_row.product_id, v_row.entitlement_type, v_row.value, v_row.expires_at;
end;
$$;

create or replace function public.soft_delete_my_message(
  p_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages%rowtype;
begin
  select *
  into v_message
  from public.messages
  where id = p_message_id
    and sender_user_id = auth.uid()
    and sender_deleted_at is null
    and created_at >= now() - interval '5 minutes';

  if not found then
    raise exception 'MESSAGE_DELETE_WINDOW_EXPIRED';
  end if;

  update public.messages
  set body = '삭제된 메시지입니다.',
      reply_to_message_id = null,
      secret_recipient_user_id = null,
      story_id = null,
      media_group_id = null,
      sender_deleted_at = now()
  where id = p_message_id;

  update public.rooms
  set updated_at = now()
  where id = v_message.room_id;
end;
$$;

create or replace function public.list_reported_room_ids()
returns table(room_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select distinct target_id::uuid
  from public.reports
  where reporter_user_id = auth.uid()
    and target_type = 'room'
    and target_id::text ~ '^[0-9a-fA-F-]{36}$';
$$;

create or replace function public.set_room_member_mute(
  p_room_id uuid,
  p_target_user_id uuid,
  p_duration_seconds integer
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
  v_actor_name text := '멤버';
  v_target_name text := '멤버';
  v_muted_until timestamptz;
  v_duration_label text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_duration_seconds not in (10, 30, 60, 300, 600, 3600) then
    raise exception 'INVALID_MUTE_DURATION';
  end if;

  select role into v_actor_role
  from public.room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role
  from public.room_memberships
  where room_id = p_room_id and user_id = p_target_user_id and status = 'active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'CANNOT_MUTE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  v_muted_until := now() + make_interval(secs => p_duration_seconds);
  v_duration_label := case p_duration_seconds
    when 10 then '10초'
    when 30 then '30초'
    when 60 then '1분'
    when 300 then '5분'
    when 600 then '10분'
    else '1시간'
  end;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_actor_name
  from public.room_profiles
  where room_id = p_room_id and user_id = auth.uid();
  v_actor_name := coalesce(v_actor_name, '멤버');

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_target_name
  from public.room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;
  v_target_name := coalesce(v_target_name, '멤버');

  insert into public.room_member_mutes(
    room_id, user_id, muted_until, created_by_user_id, created_at, cleared_at, cleared_by_user_id
  ) values (
    p_room_id, p_target_user_id, v_muted_until, auth.uid(), now(), null, null
  )
  on conflict (room_id, user_id) do update
  set muted_until = excluded.muted_until,
      created_by_user_id = excluded.created_by_user_id,
      created_at = now(),
      cleared_at = null,
      cleared_by_user_id = null;

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id,
    null,
    'system',
    v_target_name || '님이 ' || v_duration_label || ' 동안 채팅 금지되었습니다.'
  );

  insert into public.room_audit_logs(room_id, actor_user_id, target_user_id, action, metadata)
  values (
    p_room_id, auth.uid(), p_target_user_id, 'member_muted',
    jsonb_build_object('duration_seconds', p_duration_seconds, 'duration_label', v_duration_label, 'actor_name', v_actor_name, 'target_name', v_target_name)
  );

  update public.rooms set updated_at = now() where id = p_room_id;
  return v_muted_until;
end;
$$;

create or replace function public.clear_room_member_mute(
  p_room_id uuid,
  p_target_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.room_role;
  v_target_role public.room_role;
  v_target_name text := '멤버';
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select role into v_actor_role
  from public.room_memberships
  where room_id = p_room_id and user_id = auth.uid() and status = 'active';
  if v_actor_role not in ('owner', 'cohost') then raise exception 'FORBIDDEN'; end if;

  select role into v_target_role
  from public.room_memberships
  where room_id = p_room_id and user_id = p_target_user_id and status = 'active';
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_target_role = 'owner' then raise exception 'CANNOT_MUTE_OWNER'; end if;
  if v_actor_role = 'cohost' and v_target_role = 'cohost' then raise exception 'FORBIDDEN'; end if;

  update public.room_member_mutes
  set muted_until = now(), cleared_at = now(), cleared_by_user_id = auth.uid()
  where room_id = p_room_id and user_id = p_target_user_id and cleared_at is null;

  select coalesce(nullif(trim(display_name), ''), '멤버') into v_target_name
  from public.room_profiles
  where room_id = p_room_id and user_id = p_target_user_id;
  v_target_name := coalesce(v_target_name, '멤버');

  insert into public.messages(room_id, sender_user_id, kind, body)
  values (p_room_id, null, 'system', v_target_name || '님의 채팅 금지가 해제되었습니다.');

  insert into public.room_audit_logs(room_id, actor_user_id, target_user_id, action)
  values (p_room_id, auth.uid(), p_target_user_id, 'member_unmuted');

  update public.rooms set updated_at = now() where id = p_room_id;
end;
$$;

grant execute on function public.soft_delete_my_message(uuid) to authenticated;
grant execute on function public.list_reported_room_ids() to authenticated;
