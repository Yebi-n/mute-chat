create or replace function public.list_reported_room_ids()
returns table(room_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select distinct hidden_rooms.room_id
  from (
    select report.target_id::uuid as room_id
    from public.reports report
    where report.reporter_user_id = auth.uid()
      and report.target_type = 'room'
      and report.target_id::text ~ '^[0-9a-fA-F-]{36}$'
      and not exists (
        select 1
        from public.room_memberships membership
        where membership.room_id = report.target_id::uuid
          and membership.user_id = auth.uid()
          and membership.status = 'active'
          and membership.left_at is null
      )
    union
    select ban.room_id
    from public.room_bans ban
    where ban.user_id = auth.uid()
      and ban.revoked_at is null
  ) hidden_rooms;
$$;

revoke all on function public.list_reported_room_ids() from public;
grant execute on function public.list_reported_room_ids() to authenticated;
