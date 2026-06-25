create or replace function public.get_my_active_chat_entitlements_v2()
returns table(product_id text, entitlement_type text, value text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_entitlements e
  where e.user_id = auth.uid()
    and e.expires_at is not null
    and e.expires_at <= now();

  return query
  select
    e.product_id,
    e.entitlement_type,
    e.value,
    e.expires_at
  from public.user_entitlements e
  where e.user_id = auth.uid()
    and e.expires_at > now()
  order by e.expires_at;
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

  if p_product_id not in (
    'mute_custom_bubble_color',
    'mute_custom_text_color',
    'mute_custom_background'
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
  select
    v_row.product_id,
    v_row.entitlement_type,
    v_row.value,
    v_row.expires_at;
end;
$$;

create or replace function public.list_pending_room_join_requests(
  p_room_id uuid
)
returns table(
  id uuid,
  user_id uuid,
  requested_name text,
  requested_introduction text,
  status public.membership_status,
  created_at timestamptz,
  requested_avatar_path text
)
language sql
security definer
set search_path = public
as $$
  select
    req.id,
    req.user_id,
    req.requested_name,
    req.requested_introduction,
    req.status,
    req.created_at,
    req.requested_avatar_path
  from public.room_join_requests req
  where req.room_id = p_room_id
    and req.status = 'pending'
    and (
      public.is_system_admin()
      or exists (
        select 1
        from public.room_memberships staff
        where staff.room_id = req.room_id
          and staff.user_id = auth.uid()
          and staff.status = 'active'
          and staff.role in ('owner', 'cohost')
      )
    )
  order by req.created_at asc;
$$;

revoke all on function public.get_my_active_chat_entitlements_v2() from public;
revoke all on function public.set_custom_chat_entitlement_value(text, text) from public;
revoke all on function public.list_pending_room_join_requests(uuid) from public;

grant execute on function public.get_my_active_chat_entitlements_v2() to authenticated;
grant execute on function public.set_custom_chat_entitlement_value(text, text) to authenticated;
grant execute on function public.list_pending_room_join_requests(uuid) to authenticated;
