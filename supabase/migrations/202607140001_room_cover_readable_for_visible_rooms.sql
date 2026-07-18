create or replace function public.can_read_room_cover(p_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.rooms room
    where room.id = p_room_id
      and room.deleted_at is null
      and coalesce(room.moderation_status, 'active') = 'active'
      and (
        public.is_system_admin()
        or room.category <> 'adult'
        or public.is_active_room_member(room.id)
        or exists (
          select 1
          from public.users viewer
          where viewer.id = auth.uid()
            and viewer.adult_verified_at is not null
        )
      )
  );
$$;

revoke all on function public.can_read_room_cover(uuid) from public;
grant execute on function public.can_read_room_cover(uuid) to authenticated;

drop policy if exists room_covers_read_allowed on storage.objects;
create policy room_covers_read_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'room-covers'
    and public.can_read_room_cover(public.storage_room_id(name))
  );
