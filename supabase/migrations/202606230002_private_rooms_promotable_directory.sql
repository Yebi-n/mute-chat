drop policy if exists rooms_visibility_and_age_read on public.rooms;

create policy rooms_visibility_and_age_read on public.rooms
  for select using (
    deleted_at is null
    and moderation_status = 'active'
    and (
      public.is_system_admin()
      or category <> 'adult'
      or public.is_active_room_member(id)
      or exists (
        select 1
        from public.users viewer
        where viewer.id = auth.uid()
          and viewer.adult_verified_at is not null
      )
    )
  );
