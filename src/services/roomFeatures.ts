import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { schedulePendingPushDispatch } from './notifications';
import { getCachedSignedUrls } from './signedUrls';

function schedulePushBestEffort() {
  try {
    if (typeof schedulePendingPushDispatch === 'function')
      schedulePendingPushDispatch();
  } catch {
    // Push dispatch is ancillary; room mutations already committed.
  }
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export async function kickOrBanRoomMember(input: {
  roomId: string;
  userId: string;
  ban: boolean;
  reason?: string;
}) {
  const { error } = await requireClient().rpc('kick_or_ban_room_member', {
    p_room_id: input.roomId,
    p_target_user_id: input.userId,
    p_ban: input.ban,
    p_reason: input.reason ?? '',
  });
  if (error) throw error;
  schedulePushBestEffort();
}

export async function unbanRoomMember(roomId: string, userId: string) {
  const { error } = await requireClient().rpc('unban_room_member', {
    p_room_id: roomId,
    p_target_user_id: userId,
  });
  if (error) throw error;
}

export async function listBlockedRoomMembers(roomId:string){
  const {data,error}=await requireClient()
    .from('room_bans')
    .select('user_id,reason,created_at')
    .eq('room_id',roomId)
    .is('revoked_at',null)
    .order('created_at',{ascending:false});
  if(error)throw error;
  return data??[];
}

export async function listDepartedRoomMembers(roomId: string) {
  const client = requireClient();
  const { data, error } = await client.rpc('list_departed_room_members', {
    p_room_id: roomId,
  });
  if (error) throw error;
  const rows = (data ?? []) as {
    user_id: string;
    display_name: string;
    avatar_asset_path: string | null;
    left_at: string | null;
  }[];
  const paths = [...new Set(rows.map((row) => row.avatar_asset_path).filter((value): value is string => Boolean(value)))];
  const signedByPath = await getCachedSignedUrls('profile-avatars', paths)
    .catch(() => new Map<string, string>());
  return rows.map((row) => ({
    userId: row.user_id as string,
    name: row.display_name as string,
    avatarUri: row.avatar_asset_path ? signedByPath.get(row.avatar_asset_path as string) : undefined,
    leftAt: row.left_at as string | null,
  }));
}

export async function configureRoomAccess(input: {
  roomId: string;
  visibility: 'public' | 'private';
  pin?: string;
}) {
  const { error } = await requireClient().rpc('configure_room_access', {
    p_room_id: input.roomId,
    p_visibility: input.visibility,
    p_pin: input.pin || null,
  });
  if (error) throw error;
  schedulePushBestEffort();
}

export async function verifyRoomPin(roomId: string, pin: string) {
  const { data, error } = await requireClient().rpc('verify_room_pin', {
    p_room_id: roomId,
    p_pin: pin,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function setRoomPinned(roomId: string, pinned: boolean) {
  const { error } = await requireClient().rpc('set_room_pin_preference', {
    p_room_id: roomId,
    p_pinned: pinned,
  });
  if (error) throw error;
}

export async function listPinnedRoomIds() {
  const { data, error } = await requireClient()
    .from('room_user_preferences')
    .select('room_id')
    .eq('pinned', true);
  if (error) throw error;
  return (data ?? []).map((row) => row.room_id as string);
}

export async function listMutedRoomNotificationIds() {
  const { data, error } = await requireClient()
    .from('room_user_preferences')
    .select('room_id')
    .eq('notifications_enabled', false);
  if (error) throw error;
  return (data ?? []).map((row) => row.room_id as string);
}

export async function leaveRoom(roomId:string) {
  const { error } = await requireClient().rpc('leave_room', { p_room_id: roomId });
  if (error) throw error;
}

export async function deleteRoom(roomId: string) {
  const { error } = await requireClient().rpc('delete_room_as_owner', {
    p_room_id: roomId,
  });
  if (error) throw error;
  schedulePushBestEffort();
}

export async function getRoomNotificationsEnabled(roomId:string) {
  const {data,error}=await requireClient().rpc('get_room_notifications_enabled',{p_room_id:roomId});
  if(error)throw error;
  return data!==false;
}

export async function setRoomNotificationsEnabled(roomId:string,enabled:boolean) {
  const {error}=await requireClient().rpc('set_room_notifications_enabled',{
    p_room_id:roomId,
    p_enabled:enabled,
  });
  if(error)throw error;
}

export async function setRoomMemberRole(roomId: string, userId: string, role: 'member' | 'cohost') {
  const { error } = await requireClient().rpc('set_room_member_role', {
    p_room_id: roomId,
    p_target_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
  schedulePushBestEffort();
}

export async function transferRoomOwnership(roomId: string, userId: string) {
  const { error } = await requireClient().rpc('transfer_room_ownership', {
    p_room_id: roomId,
    p_target_user_id: userId,
  });
  if (error) throw error;
  schedulePushBestEffort();
}

export async function setRoomMemberMute(roomId: string, userId: string, durationSeconds: number) {
  const { data, error } = await requireClient().rpc('set_room_member_mute', {
    p_room_id: roomId,
    p_target_user_id: userId,
    p_duration_seconds: durationSeconds,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !Number.isFinite(Date.parse(data)))
    throw new Error('ROOM_MUTE_INVALID_RESPONSE');
  schedulePushBestEffort();
  return data;
}

export async function clearRoomMemberMute(roomId: string, userId: string) {
  const { error } = await requireClient().rpc('clear_room_member_mute', {
    p_room_id: roomId,
    p_target_user_id: userId,
  });
  if (error) throw error;
  schedulePushBestEffort();
}
