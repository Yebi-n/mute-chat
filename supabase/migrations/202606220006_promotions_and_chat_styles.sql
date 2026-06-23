alter table public.user_entitlements drop constraint if exists user_entitlements_entitlement_type_check;
alter table public.user_entitlements add constraint user_entitlements_entitlement_type_check
check (entitlement_type in ('bubble_color','text_color','custom_color','background_color','ad_free'));

create or replace function public.set_chat_entitlement_expiry()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.entitlement_type in ('bubble_color','text_color','custom_color','background_color') then
    new.expires_at := greatest(coalesce(old.expires_at, now()), now()) + interval '7 days';
  end if;
  return new;
end; $$;

drop trigger if exists user_entitlements_seven_days on public.user_entitlements;
create trigger user_entitlements_seven_days before insert or update on public.user_entitlements
for each row execute function public.set_chat_entitlement_expiry();

create table if not exists public.room_member_chat_styles (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  bubble_color text not null default '#F5F5F5' check (bubble_color ~ '^#[0-9A-Fa-f]{6}$'),
  bubble_product_id text,
  text_color text not null default '#1C1C1C' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_product_id text,
  background_color text not null default '#FFFFFF' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_product_id text,
  updated_at timestamptz not null default now(),
  primary key (room_id,user_id)
);

alter table public.room_member_chat_styles enable row level security;
drop policy if exists room_chat_styles_read_members on public.room_member_chat_styles;
create policy room_chat_styles_read_members on public.room_member_chat_styles for select to authenticated
using (public.is_active_room_member(room_id) or public.is_system_admin());

create or replace function public.set_my_room_chat_style(
  p_room_id uuid,
  p_bubble_color text,
  p_bubble_product_id text,
  p_text_color text,
  p_text_product_id text,
  p_background_color text,
  p_background_product_id text
) returns void language plpgsql security definer set search_path = public as $$
declare v_product text;
begin
  if not public.is_active_room_member(p_room_id) then raise exception 'ROOM_MEMBERS_ONLY'; end if;
  if p_bubble_color !~ '^#[0-9A-Fa-f]{6}$' or p_text_color !~ '^#[0-9A-Fa-f]{6}$' or p_background_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'INVALID_COLOR'; end if;
  foreach v_product in array array[p_bubble_product_id,p_text_product_id,p_background_product_id] loop
    if v_product is not null and not exists (
      select 1 from public.user_entitlements
      where user_id=auth.uid() and product_id=v_product and expires_at>now()
    ) then raise exception 'ENTITLEMENT_REQUIRED'; end if;
  end loop;
  insert into public.room_member_chat_styles(room_id,user_id,bubble_color,bubble_product_id,text_color,text_product_id,background_color,background_product_id,updated_at)
  values(p_room_id,auth.uid(),upper(p_bubble_color),p_bubble_product_id,upper(p_text_color),p_text_product_id,upper(p_background_color),p_background_product_id,now())
  on conflict(room_id,user_id) do update set
    bubble_color=excluded.bubble_color,bubble_product_id=excluded.bubble_product_id,
    text_color=excluded.text_color,text_product_id=excluded.text_product_id,
    background_color=excluded.background_color,background_product_id=excluded.background_product_id,updated_at=now();
end; $$;

create or replace function public.get_room_chat_styles(p_room_id uuid)
returns table(user_id uuid,bubble_color text,text_color text,background_color text,bubble_product_id text,text_product_id text,background_product_id text)
language sql security definer set search_path = public as $$
  select s.user_id,
    case when s.bubble_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.bubble_product_id and e.expires_at>now()) then s.bubble_color else '#F5F5F5' end,
    case when s.text_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.text_product_id and e.expires_at>now()) then s.text_color else '#1C1C1C' end,
    case when s.background_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.background_product_id and e.expires_at>now()) then s.background_color else '#FFFFFF' end,
    case when s.bubble_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.bubble_product_id and e.expires_at>now()) then s.bubble_product_id else null end,
    case when s.text_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.text_product_id and e.expires_at>now()) then s.text_product_id else null end,
    case when s.background_product_id is null or exists(select 1 from user_entitlements e where e.user_id=s.user_id and e.product_id=s.background_product_id and e.expires_at>now()) then s.background_product_id else null end
  from room_member_chat_styles s
  where s.room_id=p_room_id and (public.is_active_room_member(p_room_id) or public.is_system_admin());
$$;

create or replace function public.get_my_active_chat_entitlements()
returns table(product_id text,entitlement_type text,expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  delete from user_entitlements e where e.user_id=auth.uid() and e.expires_at is not null and e.expires_at<=now();
  return query select e.product_id,e.entitlement_type,e.expires_at from user_entitlements e
  where e.user_id=auth.uid() and e.expires_at>now() order by e.expires_at;
end;
$$;

create or replace function public.purchase_custom_background()
returns table(point_balance integer,product_id text,entitlement_type text,value text,expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  update users u set point_balance=u.point_balance-3200,updated_at=now()
  where u.id=auth.uid() and u.point_balance>=3200 returning u.point_balance into point_balance;
  if not found then raise exception 'INSUFFICIENT_POINTS'; end if;
  insert into point_ledger(user_id,amount,reason,reference_id) values(auth.uid(),-3200,'point_product_purchase','mute_custom_background');
  insert into user_entitlements(user_id,product_id,entitlement_type,value)
  values(auth.uid(),'mute_custom_background','background_color','mute_custom_background')
  on conflict(user_id,product_id) do update set entitlement_type=excluded.entitlement_type,value=excluded.value;
  select e.product_id,e.entitlement_type,e.value,e.expires_at into product_id,entitlement_type,value,expires_at
  from user_entitlements e where e.user_id=auth.uid() and e.product_id='mute_custom_background';
  return next;
end; $$;

create table if not exists public.room_promotions (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  last_promoted_at timestamptz not null,
  promotion_count integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.room_promotions enable row level security;
drop policy if exists room_promotions_read on public.room_promotions;
create policy room_promotions_read on public.room_promotions for select to authenticated using (true);

create or replace function public.promote_room(p_room_id uuid)
returns table(last_promoted_at timestamptz,next_available_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_last timestamptz; v_name text;
begin
  if not exists(select 1 from room_memberships where room_id=p_room_id and user_id=auth.uid() and status='active' and role='owner') then raise exception 'OWNER_ONLY'; end if;
  if exists(select 1 from rooms where id=p_room_id and category='adult') then raise exception 'ADULT_PROMOTION_DISABLED'; end if;
  select rp.last_promoted_at into v_last from room_promotions rp where rp.room_id=p_room_id for update;
  if v_last is not null and v_last+interval '15 minutes'>now() then raise exception 'PROMOTION_COOLDOWN:%',extract(epoch from (v_last+interval '15 minutes'-now()))::integer; end if;
  insert into room_promotions(room_id,last_promoted_at,promotion_count,updated_at) values(p_room_id,now(),1,now())
  on conflict(room_id) do update set last_promoted_at=now(),promotion_count=room_promotions.promotion_count+1,updated_at=now()
  returning room_promotions.last_promoted_at into last_promoted_at;
  select coalesce(nullif(trim(display_name),''),'방장') into v_name from room_profiles where room_id=p_room_id and user_id=auth.uid();
  insert into messages(room_id,sender_user_id,kind,body) values(p_room_id,null,'system',coalesce(v_name,'방장')||'님이 프로모션을 돌렸습니다.');
  update rooms set updated_at=now() where id=p_room_id;
  next_available_at:=last_promoted_at+interval '15 minutes'; return next;
end; $$;

revoke all on function public.set_my_room_chat_style(uuid,text,text,text,text,text,text) from public;
revoke all on function public.get_room_chat_styles(uuid) from public;
revoke all on function public.get_my_active_chat_entitlements() from public;
revoke all on function public.promote_room(uuid) from public;
revoke all on function public.purchase_custom_background() from public;
grant execute on function public.set_my_room_chat_style(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.get_room_chat_styles(uuid) to authenticated;
grant execute on function public.get_my_active_chat_entitlements() to authenticated;
grant execute on function public.promote_room(uuid) to authenticated;
grant execute on function public.purchase_custom_background() to authenticated;

do $$ begin alter publication supabase_realtime add table public.room_member_chat_styles; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.room_promotions; exception when duplicate_object then null; end $$;
