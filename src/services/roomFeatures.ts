import { isSupabaseConfigured, supabase } from '../lib/supabase';

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

export async function setRoomMemberRole(roomId: string, userId: string, role: 'member' | 'cohost') {
  const { error } = await requireClient().rpc('set_room_member_role', {
    p_room_id: roomId,
    p_target_user_id: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function transferRoomOwnership(roomId: string, userId: string) {
  const { error } = await requireClient().rpc('transfer_room_ownership', {
    p_room_id: roomId,
    p_target_user_id: userId,
  });
  if (error) throw error;
}
