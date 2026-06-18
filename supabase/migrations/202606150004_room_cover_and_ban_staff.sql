create or replace function public.set_room_cover_from_upload(
  p_room_id uuid,
  p_upload_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
begin
  if not public.is_room_staff(p_room_id) then raise exception 'FORBIDDEN'; end if;

  select object_path into v_path
  from media_uploads
  where id = p_upload_id
    and owner_user_id = auth.uid()
    and room_id = p_room_id
    and bucket_id = 'room-covers'
    and status = 'validated';

  if v_path is null then raise exception 'INVALID_COVER_UPLOAD'; end if;

  update rooms
  set cover_asset_path = v_path,
      updated_at = now()
  where id = p_room_id and deleted_at is null;

  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  return v_path;
end;
$$;

revoke all on function public.set_room_cover_from_upload(uuid,uuid) from public;
grant execute on function public.set_room_cover_from_upload(uuid,uuid) to authenticated;

drop policy if exists room_bans_read_staff on public.room_bans;
create policy room_bans_read_staff on public.room_bans
  for select using (public.is_room_staff(room_id));
