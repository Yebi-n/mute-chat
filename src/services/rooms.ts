import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type CreateRoomInput = {
  name: string;
  description: string;
  category: 'member' | 'concept' | 'region' | 'adult';
  maxMembers: number;
  region?: string;
};

export type ServerRoom = {
  id: string;
  name: string;
  description: string;
  category: CreateRoomInput['category'];
  region: string | null;
  max_members: number;
  visibility?: 'public' | 'private';
  cover_asset_path: string | null;
  cover_url?: string;
  member_count?: number;
  created_at: string;
  updated_at: string;
};

export type ServerRoomMember = {
  userId: string;
  name: string;
  intro: string;
  role: 'owner' | 'cohost' | 'member';
  avatarUrl?: string;
  mutedUntil?: string | null;
};

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export async function createRoom(input: CreateRoomInput) {
  const client = requireClient();
  const { data, error } = await client.rpc('create_room', {
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    p_max_members: input.maxMembers,
    p_region: input.region ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateRoom(input: CreateRoomInput & { roomId:string }) {
  const { error } = await requireClient().rpc('update_room_details', {
    p_room_id: input.roomId,
    p_name: input.name,
    p_description: input.description,
    p_category: input.category,
    p_max_members: input.maxMembers,
    p_region: input.region ?? null,
  });
  if (error) throw error;
}

export async function listRooms() {
  const client = requireClient();
  const { data, error } = await client
    .from('rooms')
    .select('id,name,description,category,region,max_members,visibility,cover_asset_path,created_at,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows=(data ?? []) as ServerRoom[];
  const roomIds=rows.map((row)=>row.id);
  const { data: membershipRows, error: membershipError } = roomIds.length
    ? await client.rpc('get_room_member_counts', { p_room_ids: roomIds })
    : { data: [], error: null };
  if (membershipError) throw membershipError;
  const memberCountByRoom = new Map<string, number>();
  (membershipRows ?? []).forEach((row: { room_id: string; member_count: number | string }) => memberCountByRoom.set(row.room_id, Number(row.member_count ?? 0)));
  return Promise.all(rows.map(async(row)=>{
    const baseRow = { ...row, member_count: memberCountByRoom.get(row.id) ?? 0 };
    if(!row.cover_asset_path)return baseRow;
    const {data:signed,error:signedError}=await client.storage.from('room-covers').createSignedUrl(row.cover_asset_path,3600);
    if(signedError)return baseRow;
    return {...baseRow,cover_url:signed?.signedUrl};
  }));
}

export async function listRoomMembers(roomId: string) {
  const client = requireClient();
  const [
    { data: membershipRows, error: membershipError },
    { data: profileRows, error: profileError },
    { data: muteRows, error: muteError },
  ] = await Promise.all([
    client
      .from('room_memberships')
      .select('user_id,role')
      .eq('room_id', roomId)
      .eq('status', 'active'),
    client
      .from('room_profiles')
      .select('user_id,display_name,introduction,avatar_asset_path')
      .eq('room_id', roomId),
    client
      .from('room_member_mutes')
      .select('user_id,muted_until')
      .eq('room_id', roomId)
      .is('cleared_at', null)
      .gt('muted_until', new Date().toISOString()),
  ]);
  if (membershipError) throw membershipError;
  if (profileError) throw profileError;
  if (muteError) throw muteError;

  const avatarPaths = (profileRows ?? [])
    .map((row) => row.avatar_asset_path as string | null)
    .filter((value): value is string => Boolean(value));
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signedRows, error: signedError } = await client.storage
      .from('profile-avatars')
      .createSignedUrls(avatarPaths, 3600);
    if (signedError) throw signedError;
    signedRows?.forEach((row, index) => {
      if (row.signedUrl) avatarUrlByPath.set(avatarPaths[index], row.signedUrl);
    });
  }

  const profileByUserId = new Map(
    (profileRows ?? []).map((row) => [
      row.user_id as string,
      {
        name: row.display_name as string,
        intro: row.introduction as string,
        avatarUrl: row.avatar_asset_path ? avatarUrlByPath.get(row.avatar_asset_path as string) : undefined,
      },
    ]),
  );
  const mutedUntilByUserId = new Map(
    (muteRows ?? []).map((row) => [row.user_id as string, row.muted_until as string]),
  );

  return (membershipRows ?? []).map((row) => {
    const profile = profileByUserId.get(row.user_id as string);
    return {
      userId: row.user_id as string,
      role: row.role as 'owner' | 'cohost' | 'member',
      name: profile?.name?.trim() || '멤버',
      intro: profile?.intro ?? '',
      avatarUrl: profile?.avatarUrl,
      mutedUntil: mutedUntilByUserId.get(row.user_id as string) ?? null,
    } satisfies ServerRoomMember;
  });
}

export async function setRoomCover(roomId:string,uploadId:string){
  const {error}=await requireClient().rpc('set_room_cover_from_upload',{
    p_room_id:roomId,
    p_upload_id:uploadId,
  });
  if(error)throw error;
}

export async function clearRoomCover(roomId:string){
  const {error}=await requireClient().rpc('clear_room_cover',{
    p_room_id:roomId,
  });
  if(error)throw error;
}

export async function setRoomOwnerProfile(input:{
  roomId:string;
  displayName:string;
  introduction:string;
  avatarUploadId?:string;
}){
  const {error}=await requireClient().rpc('set_room_owner_profile',{
    p_room_id:input.roomId,
    p_display_name:input.displayName,
    p_introduction:input.introduction,
    p_avatar_upload_id:input.avatarUploadId??null,
  });
  if(error)throw error;
}

export async function clearRoomProfileAvatar(roomId:string){
  const {error}=await requireClient().rpc('clear_room_profile_avatar',{
    p_room_id:roomId,
  });
  if(error)throw error;
}

export async function listMyActiveRoomIds() {
  const client = requireClient();
  const { data, error } = await client
    .from('room_memberships')
    .select('room_id')
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map((item) => item.room_id as string);
}

export async function requestRoomJoin(roomId: string, name: string, introduction: string) {
  const client = requireClient();
  const { error } = await client.rpc('request_room_join', {
    p_room_id: roomId,
    p_name: name,
    p_introduction: introduction,
  });
  if (error) throw error;
}

export async function requestRoomJoinWithAvatar(roomId: string, name: string, introduction: string, avatarUploadId?: string) {
  const { error } = await requireClient().rpc('request_room_join_v2', {
    p_room_id: roomId,
    p_name: name,
    p_introduction: introduction,
    p_avatar_upload_id: avatarUploadId ?? null,
  });
  if (error) throw error;
}

export async function joinRoomAsSystemAdmin(roomId: string) {
  const { error } = await requireClient().rpc('admin_join_room', {
    p_room_id: roomId,
  });
  if (error) throw error;
}

export async function decideRoomJoin(requestId: string, approve: boolean) {
  const client = requireClient();
  const { error } = await client.rpc('decide_room_join', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function listPendingRoomJoinRequests(roomId: string) {
  const { data, error } = await requireClient()
    .from('room_join_requests')
    .select('id,user_id,requested_name,requested_introduction,status,created_at')
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listRoomMembersVisible(roomId: string): Promise<ServerRoomMember[]> {
  const client = requireClient();
  const { data, error } = await client.rpc('list_room_members_public', {
    p_room_id: roomId,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    introduction: string | null;
    role: 'owner' | 'cohost' | 'member';
    avatar_asset_path: string | null;
    muted_until: string | null;
  }>;
  const avatarPaths = rows
    .map((row) => row.avatar_asset_path)
    .filter((value): value is string => Boolean(value));
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signedRows, error: signedError } = await client.storage
      .from('profile-avatars')
      .createSignedUrls(avatarPaths, 3600);
    if (signedError) throw signedError;
    signedRows?.forEach((row, index) => {
      if (row.signedUrl) avatarUrlByPath.set(avatarPaths[index], row.signedUrl);
    });
  }
  return rows.map((row) => ({
    userId: row.user_id,
    name: row.display_name?.trim() || '멤버',
    intro: row.introduction ?? '',
    role: row.role,
    avatarUrl: row.avatar_asset_path ? avatarUrlByPath.get(row.avatar_asset_path) : undefined,
    mutedUntil: row.muted_until ?? null,
  }));
}

export async function listPendingRoomJoinRequestsWithAvatars(roomId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('room_join_requests')
    .select('id,user_id,requested_name,requested_introduction,status,created_at,avatar_asset_path')
    .eq('room_id', roomId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const avatarPaths = rows
    .map((row) => row.avatar_asset_path as string | null)
    .filter((value): value is string => Boolean(value));
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signedRows, error: signedError } = await client.storage
      .from('profile-avatars')
      .createSignedUrls(avatarPaths, 3600);
    if (signedError) throw signedError;
    signedRows?.forEach((row, index) => {
      if (row.signedUrl) avatarUrlByPath.set(avatarPaths[index], row.signedUrl);
    });
  }
  return rows.map((row) => ({
    ...row,
    avatar_url: row.avatar_asset_path ? avatarUrlByPath.get(row.avatar_asset_path as string) : undefined,
  }));
}
