import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dispatchPendingPushes } from './notifications';

export type ServerRoomMessage = {
  id: string;
  userId: string | null;
  kind: 'text' | 'image' | 'system' | 'secret' | 'story';
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
  storyId?: string;
  storyTitle?: string;
  storyPreview?: string;
  storyImageUri?: string;
  bubbleColor?:string;
  textColor?:string;
};

export type RoomReadReceipt = {
  roomId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
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
  dispatchPendingPushes().catch(() => undefined);
  return data as string;
}

export async function sendSecretMessage(input: {
  roomId: string;
  body: string;
  recipientUserId: string;
  replyToMessageId?: string;
}) {
  const { data, error } = await requireClient().rpc('send_room_message', {
    p_room_id: input.roomId,
    p_kind: 'secret',
    p_body: input.body,
    p_reply_to_message_id: input.replyToMessageId ?? null,
    p_secret_recipient_user_id: input.recipientUserId,
    p_media_group_id: null,
  });
  if (error) throw error;
  dispatchPendingPushes().catch(() => undefined);
  return data as string;
}

export async function sendSystemMessage(input: {
  roomId: string;
  body: string;
}) {
  const { data, error } = await requireClient().rpc('send_room_message', {
    p_room_id: input.roomId,
    p_kind: 'system',
    p_body: input.body,
    p_reply_to_message_id: null,
    p_secret_recipient_user_id: null,
    p_media_group_id: null,
  });
  if (error) throw error;
  dispatchPendingPushes().catch(() => undefined);
  return data as string;
}

export async function announceStoryCreated(storyId: string) {
  const { data, error } = await requireClient().rpc('announce_story_created', {
    p_story_id: storyId,
  });
  if (error) throw error;
  dispatchPendingPushes().catch(() => undefined);
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

export async function getRoomMessageCreatedAt(messageId: string) {
  const { data, error } = await requireClient()
    .from('messages')
    .select('created_at')
    .eq('id', messageId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at as string | undefined;
}

export async function listRoomMessages(roomId: string, limit = 50, before?: string) {
  const client = requireClient();
  const { data: membership } = await client
    .from('room_memberships')
    .select('joined_at')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .maybeSingle();
  let messageQuery = client
    .from('messages')
    .select('id,sender_user_id,kind,body,reply_to_message_id,secret_recipient_user_id,media_group_id,story_id,created_at')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (membership?.joined_at) messageQuery = messageQuery.gte('created_at', membership.joined_at as string);
  if (before) messageQuery = messageQuery.lt('created_at', before);
  const { data: descendingRows, error: messageError } = await messageQuery;
  if (messageError) throw messageError;
  const messageRows = [...(descendingRows ?? [])].reverse();
  if (!messageRows?.length) return [] as ServerRoomMessage[];

  const userIds = [...new Set(messageRows.flatMap((row) => [row.sender_user_id, row.secret_recipient_user_id]).filter((value): value is string => Boolean(value)))];
  const replyIds = [...new Set(messageRows.map((row) => row.reply_to_message_id).filter((value): value is string => Boolean(value)))];
  const mediaGroupIds = [...new Set(messageRows.map((row) => row.media_group_id).filter((value): value is string => Boolean(value)))];
  const storyIds = [...new Set(messageRows.map((row) => row.story_id).filter((value): value is string => Boolean(value)))];

  const [
    { data: profileRows, error: profileError },
    { data: replyRows, error: replyError },
    { data: assetRows, error: assetError },
    { data: storyRows, error: storyError },
    { data: storyBlockRows, error: storyBlockError },
    { data: styleRows, error: styleError },
  ] = await Promise.all([
    client.from('room_profiles').select('user_id,display_name,avatar_asset_path').eq('room_id', roomId).in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']),
    replyIds.length
      ? client.from('messages').select('id,body,sender_user_id,kind').in('id', replyIds)
      : Promise.resolve({ data: [], error: null }),
    mediaGroupIds.length
      ? client.from('message_assets').select('message_id,storage_path,position').in('message_id', messageRows.filter((row) => row.kind === 'image').map((row) => row.id)).order('position')
      : Promise.resolve({ data: [], error: null }),
    storyIds.length
      ? client.from('stories').select('id,title').in('id', storyIds)
      : Promise.resolve({ data: [], error: null }),
    storyIds.length
      ? client.from('story_blocks').select('story_id,block_type,text_content,storage_path,position').in('story_id', storyIds).order('position')
      : Promise.resolve({ data: [], error: null }),
    client.rpc('get_room_chat_styles',{p_room_id:roomId}),
  ]);
  if (profileError) throw profileError;
  if (replyError) throw replyError;
  if (assetError) throw assetError;
  if (storyError) throw storyError;
  if (storyBlockError) throw storyBlockError;
  if (styleError) throw styleError;
  const styleByUserId=new Map<string,{bubbleColor:string;textColor:string}>(((styleRows??[]) as Array<{user_id:string;bubble_color:string;text_color:string}>).map((row)=>[row.user_id,{bubbleColor:row.bubble_color,textColor:row.text_color}]));

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
  const replyById = new Map((replyRows ?? []).map((row) => [
    row.id as string,
    row.kind === 'image' ? '사진' : row.body as string,
  ]));
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

  const storyImagePaths = (storyBlockRows ?? [])
    .map((row) => row.storage_path as string | null)
    .filter((value): value is string => Boolean(value));
  const storyImageUrlByPath = new Map<string, string>();
  if (storyImagePaths.length) {
    const { data: signedStoryRows, error: signedStoryError } = await client.storage.from('chat-media').createSignedUrls(storyImagePaths, 3600);
    if (signedStoryError) throw signedStoryError;
    signedStoryRows?.forEach((row, index) => {
      if (row.signedUrl) storyImageUrlByPath.set(storyImagePaths[index], row.signedUrl);
    });
  }
  const storyTitleById = new Map((storyRows ?? []).map((row) => [row.id as string, row.title as string]));
  const storyPreviewById = new Map<string, string>();
  const storyImageUriById = new Map<string, string>();
  (storyBlockRows ?? []).forEach((row) => {
    const storyId = row.story_id as string;
    if (row.block_type === 'text' && !storyPreviewById.has(storyId)) {
      storyPreviewById.set(storyId, String(row.text_content ?? '').slice(0, 86));
    }
    if (row.block_type === 'image' && row.storage_path && !storyImageUriById.has(storyId)) {
      const uri = storyImageUrlByPath.get(row.storage_path as string);
      if (uri) storyImageUriById.set(storyId, uri);
    }
  });

  return messageRows.map((row) => ({
    id: row.id as string,
    userId: row.sender_user_id as string | null,
    kind: row.story_id ? 'story' : row.kind as 'text' | 'image' | 'system' | 'secret',
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
    storyId: row.story_id as string | undefined,
    storyTitle: row.story_id ? storyTitleById.get(row.story_id as string) : undefined,
    storyPreview: row.story_id ? storyPreviewById.get(row.story_id as string) : undefined,
    storyImageUri: row.story_id ? storyImageUriById.get(row.story_id as string) : undefined,
    bubbleColor:row.sender_user_id?styleByUserId.get(row.sender_user_id as string)?.bubbleColor:undefined,
    textColor:row.sender_user_id?styleByUserId.get(row.sender_user_id as string)?.textColor:undefined,
  })) as ServerRoomMessage[];
}

export async function getRoomReadReceipt(roomId: string): Promise<RoomReadReceipt | null> {
  const { data, error } = await requireClient()
    .from('room_read_receipts')
    .select('room_id,last_read_message_id,last_read_at')
    .eq('room_id', roomId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    roomId: data.room_id as string,
    lastReadMessageId: data.last_read_message_id as string | null,
    lastReadAt: data.last_read_at as string,
  };
}

export async function listRoomReadReceipts(roomIds: string[]): Promise<RoomReadReceipt[]> {
  if (!roomIds.length) return [];
  const { data, error } = await requireClient()
    .from('room_read_receipts')
    .select('room_id,last_read_message_id,last_read_at')
    .in('room_id', roomIds);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    roomId: row.room_id as string,
    lastReadMessageId: row.last_read_message_id as string | null,
    lastReadAt: row.last_read_at as string,
  }));
}

export async function markRoomRead(roomId: string, lastReadMessageId: string) {
  const { error } = await requireClient().rpc('mark_room_read', {
    p_room_id: roomId,
    p_last_read_message_id: lastReadMessageId,
  });
  if (error) throw error;
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
