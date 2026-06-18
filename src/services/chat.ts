import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ServerRoomMessage = {
  id: string;
  userId: string | null;
  kind: 'text' | 'image' | 'system' | 'secret';
  body: string;
  createdAt: string;
  replyToMessageId: string | null;
  replyToBody?: string;
  replyToSenderName?: string;
  secretRecipientUserId: string | null;
  senderName?: string;
  senderAvatarUrl?: string;
  recipientName?: string;
  imageUris?: string[];
};

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export async function sendTextMessage(input: {
  roomId: string;
  body: string;
  replyToMessageId?: string;
}) {
  const { data, error } = await requireClient().rpc('send_room_message', {
    p_room_id: input.roomId,
    p_kind: 'text',
    p_body: input.body,
    p_reply_to_message_id: input.replyToMessageId ?? null,
    p_secret_recipient_user_id: null,
    p_media_group_id: null,
  });
  if (error) throw error;
  return data as string;
}

export async function searchRoomMessages(roomId: string, query: string) {
  const { data, error } = await requireClient().rpc('search_room_messages', {
    p_room_id: roomId,
    p_query: query,
    p_limit: 50,
  });
  if (error) throw error;
  return data ?? [];
}

export async function listRoomMessages(roomId: string, limit = 80) {
  const client = requireClient();
  const { data: messageRows, error: messageError } = await client
    .from('messages')
    .select('id,sender_user_id,kind,body,reply_to_message_id,secret_recipient_user_id,media_group_id,created_at')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (messageError) throw messageError;
  if (!messageRows?.length) return [] as ServerRoomMessage[];

  const userIds = [...new Set(messageRows.flatMap((row) => [row.sender_user_id, row.secret_recipient_user_id]).filter((value): value is string => Boolean(value)))];
  const replyIds = [...new Set(messageRows.map((row) => row.reply_to_message_id).filter((value): value is string => Boolean(value)))];
  const mediaGroupIds = [...new Set(messageRows.map((row) => row.media_group_id).filter((value): value is string => Boolean(value)))];

  const [
    { data: profileRows, error: profileError },
    { data: replyRows, error: replyError },
    { data: assetRows, error: assetError },
  ] = await Promise.all([
    client.from('room_profiles').select('user_id,display_name,avatar_asset_path').eq('room_id', roomId).in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
    replyIds.length
      ? client.from('messages').select('id,body,sender_user_id').in('id', replyIds)
      : Promise.resolve({ data: [], error: null }),
    mediaGroupIds.length
      ? client.from('message_assets').select('message_id,storage_path,position').in('message_id', messageRows.filter((row) => row.kind === 'image').map((row) => row.id)).order('position')
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileError) throw profileError;
  if (replyError) throw replyError;
  if (assetError) throw assetError;

  const avatarPaths = (profileRows ?? [])
    .map((row) => row.avatar_asset_path as string | null)
    .filter((value): value is string => Boolean(value));
  const avatarUrlByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signedAvatarRows, error: signedAvatarError } = await client.storage.from('profile-avatars').createSignedUrls(avatarPaths, 3600);
    if (signedAvatarError) throw signedAvatarError;
    signedAvatarRows?.forEach((row, index) => {
      if (row.signedUrl) avatarUrlByPath.set(avatarPaths[index], row.signedUrl);
    });
  }

  const assetPaths = (assetRows ?? [])
    .map((row) => row.storage_path as string | null)
    .filter((value): value is string => Boolean(value));
  const imageUrlByPath = new Map<string, string>();
  if (assetPaths.length) {
    const { data: signedAssetRows, error: signedAssetError } = await client.storage.from('chat-media').createSignedUrls(assetPaths, 3600);
    if (signedAssetError) throw signedAssetError;
    signedAssetRows?.forEach((row, index) => {
      if (row.signedUrl) imageUrlByPath.set(assetPaths[index], row.signedUrl);
    });
  }

  const profileByUserId = new Map(
    (profileRows ?? []).map((row) => [
      row.user_id as string,
      {
        name: row.display_name as string,
        avatarUrl: row.avatar_asset_path ? avatarUrlByPath.get(row.avatar_asset_path as string) : undefined,
      },
    ]),
  );
  const replyById = new Map((replyRows ?? []).map((row) => [row.id as string, row.body as string]));
  const replySenderNameById = new Map(
    (replyRows ?? []).map((row) => [
      row.id as string,
      row.sender_user_id ? profileByUserId.get(row.sender_user_id as string)?.name ?? '멤버' : '멤버',
    ]),
  );
  const imageUrisByMessageId = new Map<string, string[]>();
  (assetRows ?? []).forEach((row) => {
    const current = imageUrisByMessageId.get(row.message_id as string) ?? [];
    const uri = imageUrlByPath.get(row.storage_path as string);
    if (uri) current.push(uri);
    imageUrisByMessageId.set(row.message_id as string, current);
  });

  return messageRows.map((row) => ({
    id: row.id as string,
    userId: row.sender_user_id as string | null,
    kind: row.kind as 'text' | 'image' | 'system' | 'secret',
    body: row.body as string,
    createdAt: row.created_at as string,
    replyToMessageId: row.reply_to_message_id as string | null,
    replyToBody: row.reply_to_message_id ? replyById.get(row.reply_to_message_id as string) : undefined,
    replyToSenderName: row.reply_to_message_id ? replySenderNameById.get(row.reply_to_message_id as string) : undefined,
    secretRecipientUserId: row.secret_recipient_user_id as string | null,
    senderName: row.sender_user_id ? profileByUserId.get(row.sender_user_id as string)?.name : undefined,
    senderAvatarUrl: row.sender_user_id ? profileByUserId.get(row.sender_user_id as string)?.avatarUrl : undefined,
    recipientName: row.secret_recipient_user_id ? profileByUserId.get(row.secret_recipient_user_id as string)?.name : undefined,
    imageUris: imageUrisByMessageId.get(row.id as string),
  })) as ServerRoomMessage[];
}

export async function listRecentSystemMessages(roomId: string) {
  const { data, error } = await requireClient()
    .from('messages')
    .select('id,body,created_at')
    .eq('room_id', roomId)
    .eq('kind', 'system')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
