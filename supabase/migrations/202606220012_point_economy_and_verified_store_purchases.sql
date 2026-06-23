alter table public.user_entitlements drop constraint if exists user_entitlements_entitlement_type_check;
alter table public.user_entitlements add constraint user_entitlements_entitlement_type_check
check (entitlement_type in (
  'bubble_color', 'text_color', 'custom_color', 'background_color',
  'app_theme', 'ad_free'
));

create table if not exists public.store_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('app_store', 'play_store', 'revenuecat')),
  transaction_id text not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  entitlement_type text,
  entitlement_expires_at timestamptz,
  environment text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.store_transactions enable row level security;
drop policy if exists store_transactions_read_own on public.store_transactions;
create policy store_transactions_read_own on public.store_transactions
for select to authenticated using (user_id = auth.uid());

create or replace function public.apply_verified_store_purchase(
  p_user_id uuid,
  p_provider text,
  p_transaction_id text,
  p_product_id text,
  p_points integer,
  p_entitlement_type text default null,
  p_entitlement_expires_at timestamptz default null,
  p_environment text default null,
  p_raw_payload jsonb default '{}'::jsonb
) returns table(point_balance integer, credited boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted uuid;
begin
  if p_provider not in ('app_store', 'play_store', 'revenuecat') then
    raise exception 'INVALID_PROVIDER';
  end if;
  if nullif(trim(p_transaction_id), '') is null then raise exception 'INVALID_TRANSACTION'; end if;
  if p_points < 0 then raise exception 'INVALID_POINTS'; end if;

  insert into public.store_transactions(
    provider, transaction_id, user_id, product_id, points_awarded,
    entitlement_type, entitlement_expires_at, environment, raw_payload
  ) values (
    p_provider, trim(p_transaction_id), p_user_id, p_product_id, p_points,
    p_entitlement_type, p_entitlement_expires_at, p_environment,
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (transaction_id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    select app_user.point_balance into point_balance
    from public.users app_user where app_user.id = p_user_id;
    credited := false;
    return next;
    return;
  end if;

  if p_points > 0 then
    update public.users app_user
    set point_balance = app_user.point_balance + p_points,
        updated_at = now()
    where app_user.id = p_user_id
    returning app_user.point_balance into point_balance;
    insert into public.point_ledger(user_id, amount, reason, reference_id)
    values (p_user_id, p_points, 'store_purchase', p_transaction_id);
  else
    select app_user.point_balance into point_balance
    from public.users app_user where app_user.id = p_user_id;
  end if;

  if p_entitlement_type is not null then
    insert into public.user_entitlements(
      user_id, product_id, entitlement_type, value, expires_at
    ) values (
      p_user_id, p_product_id, p_entitlement_type, p_product_id,
      p_entitlement_expires_at
    )
    on conflict (user_id, product_id) do update
    set entitlement_type = excluded.entitlement_type,
        value = excluded.value,
        expires_at = excluded.expires_at;
  end if;

  credited := true;
  return next;
end;
$$;

revoke all on function public.apply_verified_store_purchase(uuid,text,text,text,integer,text,timestamptz,text,jsonb) from public;
grant execute on function public.apply_verified_store_purchase(uuid,text,text,text,integer,text,timestamptz,text,jsonb) to service_role;

create or replace function public.get_my_wallet()
returns table (
  point_balance integer,
  attendance_available_at timestamptz,
  rewarded_ad_available boolean
)
language sql
security definer
set search_path = public
as $$
  select
    app_user.point_balance,
    coalesce((
      select max(claim.created_at) + interval '1 hour'
      from public.reward_claims claim
      where claim.user_id = auth.uid() and claim.reward_type = 'attendance'
    ), now()),
    (
      select count(*) < 20
      from public.reward_claims claim
      where claim.user_id = auth.uid()
        and claim.reward_type = 'rewarded_ad'
        and timezone('Asia/Seoul', claim.created_at)::date =
            timezone('Asia/Seoul', now())::date
    )
  from public.users app_user
  where app_user.id = auth.uid();
$$;

create or replace function public.claim_point_reward(
  p_reward_type text,
  p_reward_key text
) returns table (
  point_balance integer,
  awarded_points integer,
  next_available_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points integer;
  v_last timestamptz;
begin
  if p_reward_type not in ('attendance', 'rewarded_ad') then
    raise exception 'INVALID_REWARD_TYPE';
  end if;
  if p_reward_type = 'attendance' then
    select max(claim.created_at) into v_last
    from public.reward_claims claim
    where claim.user_id = auth.uid() and claim.reward_type = 'attendance';
    if v_last is not null and v_last + interval '1 hour' > now() then
      raise exception 'REWARD_COOLDOWN';
    end if;
    v_points := 20;
  else
    if (
      select count(*) >= 20
      from public.reward_claims claim
      where claim.user_id = auth.uid()
        and claim.reward_type = 'rewarded_ad'
        and timezone('Asia/Seoul', claim.created_at)::date =
            timezone('Asia/Seoul', now())::date
    ) then raise exception 'DAILY_REWARD_LIMIT'; end if;
    v_points := 10;
  end if;

  insert into public.reward_claims(user_id, reward_type, reward_key, points)
  values (auth.uid(), p_reward_type, p_reward_key, v_points);
  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), v_points, p_reward_type, p_reward_key);
  update public.users app_user
  set point_balance = app_user.point_balance + v_points, updated_at = now()
  where app_user.id = auth.uid()
  returning app_user.point_balance into point_balance;
  awarded_points := v_points;
  next_available_at := case
    when p_reward_type = 'attendance' then now() + interval '1 hour'
    else now()
  end;
  return next;
end;
$$;

create or replace function public.purchase_point_product(p_product_id text)
returns table(point_balance integer, product_id text, entitlement_type text, value text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price integer;
  v_entitlement_type text;
begin
  v_price := case p_product_id
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
    when 'mute_text_color_01' then 1800
    when 'mute_text_color_02' then 1800
    when 'mute_text_color_03' then 2500
    when 'mute_text_color_04' then 2500
    when 'mute_text_color_05' then 2500
    when 'mute_text_color_06' then 2800
    when 'mute_text_color_07' then 2800
    when 'mute_text_color_08' then 3200
    when 'mute_text_color_09' then 3200
    when 'mute_custom_bubble_color' then 3200
    when 'mute_custom_text_color' then 3200
    when 'mute_custom_background' then 3200
    else null
  end;
  if v_price is null then raise exception 'POINT_PRODUCT_NOT_SUPPORTED'; end if;
  v_entitlement_type := case
    when p_product_id like 'mute_bubble_color_%' then 'bubble_color'
    when p_product_id like 'mute_text_color_%' then 'text_color'
    when p_product_id = 'mute_custom_background' then 'background_color'
    else 'custom_color'
  end;

  update public.users app_user
  set point_balance = app_user.point_balance - v_price, updated_at = now()
  where app_user.id = auth.uid() and app_user.point_balance >= v_price
  returning app_user.point_balance into point_balance;
  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;
  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -v_price, 'point_product_purchase', p_product_id);
  insert into public.user_entitlements(user_id, product_id, entitlement_type, value, expires_at)
  values (auth.uid(), p_product_id, v_entitlement_type, p_product_id, now() + interval '7 days')
  on conflict (user_id, product_id) do update
  set entitlement_type = excluded.entitlement_type,
      value = excluded.value,
      expires_at = greatest(coalesce(public.user_entitlements.expires_at, now()), now()) + interval '7 days';
  product_id := p_product_id;
  entitlement_type := v_entitlement_type;
  value := p_product_id;
  return next;
end;
$$;

revoke all on function public.get_my_wallet() from public;
revoke all on function public.claim_point_reward(text,text) from public;
revoke all on function public.purchase_point_product(text) from public;
grant execute on function public.get_my_wallet() to authenticated;
grant execute on function public.claim_point_reward(text,text) to authenticated;
grant execute on function public.purchase_point_product(text) to authenticated;

drop function if exists public.boost_room_top_space(uuid, integer);
create function public.boost_room_top_space(p_room_id uuid, p_points integer)
returns table(
  expires_at timestamptz,
  total_duration_seconds integer,
  point_balance integer,
  boost_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer;
  v_boosts integer;
  v_current_expires timestamptz;
  v_remaining integer;
  v_display_name text;
begin
  select package.seconds, package.boosts into v_seconds, v_boosts
  from (values
    (100,45,60), (500,270,360), (1000,600,800), (2000,1260,1680),
    (5000,3600,4800), (10000,9000,12000),
    (30000,36000,48000), (50000,72000,96000)
  ) as package(points, seconds, boosts)
  where package.points = p_points;
  if v_seconds is null then raise exception 'INVALID_TOP_SPACE_PACKAGE'; end if;
  if not public.is_active_room_member(p_room_id) then raise exception 'ROOM_MEMBERS_ONLY'; end if;

  update public.users app_user
  set point_balance = app_user.point_balance - p_points, updated_at = now()
  where app_user.id = auth.uid() and app_user.point_balance >= p_points
  returning app_user.point_balance into point_balance;
  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;

  select top_space.expires_at into v_current_expires
  from public.room_top_spaces top_space where top_space.room_id = p_room_id for update;
  v_remaining := greatest(0,
    extract(epoch from (coalesce(v_current_expires, now()) - now()))::integer
  );
  insert into public.room_top_spaces(
    room_id, expires_at, total_duration_seconds, boost_count, updated_at
  ) values (
    p_room_id, now() + make_interval(secs => v_remaining + v_seconds),
    v_remaining + v_seconds, v_boosts, now()
  )
  on conflict (room_id) do update
  set expires_at = excluded.expires_at,
      total_duration_seconds = excluded.total_duration_seconds,
      boost_count = public.room_top_spaces.boost_count + v_boosts,
      updated_at = now()
  returning public.room_top_spaces.expires_at,
            public.room_top_spaces.total_duration_seconds,
            public.room_top_spaces.boost_count
  into expires_at, total_duration_seconds, boost_count;
  insert into public.point_ledger(user_id, amount, reason, reference_id)
  values (auth.uid(), -p_points, 'room_top_space', p_room_id::text);
  select coalesce(nullif(trim(profile.display_name), ''), '멤버') into v_display_name
  from public.room_profiles profile
  where profile.room_id = p_room_id and profile.user_id = auth.uid();
  insert into public.messages(room_id, sender_user_id, kind, body)
  values (
    p_room_id, auth.uid(), 'system',
    coalesce(v_display_name, '멤버') || '님이 탑스페이스를 ' || v_boosts::text || '회 올렸습니다.'
  );
  update public.rooms set updated_at = now() where id = p_room_id;
  return next;
end;
$$;

revoke all on function public.boost_room_top_space(uuid, integer) from public;
grant execute on function public.boost_room_top_space(uuid, integer) to authenticated;
