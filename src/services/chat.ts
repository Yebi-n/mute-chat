import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { schedulePendingPushDispatch } from './notifications';
import { getCachedSignedUrls } from './signedUrls';

export type ServerRoomMessage = {
  id: string;
  userId: string | null;
  kind: 'text' | 'image' | 'system' | 'secret' | 'story';
  body: string;
  createdAt: string;
  senderDeletedAt?: string | null;
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

function requireMessageId(data: unknown) {
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value))
    throw new Error('MESSAGE_SEND_INVALID_RESPONSE');
  return value;
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
  const messageId = requireMessageId(data);
  schedulePendingPushDispatch();
  return messageId;
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
  const messageId = requireMessageId(data);
  schedulePendingPushDispatch();
  return messageId;
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
  const messageId = requireMessageId(data);
  schedulePendingPushDispatch();
  return messageId;
}

export async function softDeleteMyMessage(messageId: string) {
  const { error } = await requireClient().rpc('soft_delete_my_message', {
    p_message_id: messageId,
  });
  if (error) throw error;
}

export async function announceStoryCreated(storyId: string) {
  const { data, error } = await requireClient().rpc('announce_story_created', {
    p_story_id: storyId,
  });
  if (error) throw error;
  const messageId = requireMessageId(data);
  schedulePendingPushDispatch();
  return messageId;
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
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: membership } = await client
    .from('room_memberships')
    .select('joined_at')
    .eq('room_id', roomId)
    .eq('user_id', user?.id ?? '00000000-0000-0000-0000-000000000000')
    .eq('status', 'active')
    .maybeSingle();
  let messageQuery = client
    .from('messages')
    .select('id,sender_user_id,kind,body,sender_deleted_at,reply_to_message_id,secret_recipient_user_id,media_group_id,story_id,created_at,sender_display_name_snapshot,sender_avatar_asset_path_snapshot')
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
      ? client.from('messages').select('id,body,sender_user_id,kind,sender_display_name_snapshot').in('id', replyIds)
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
  // Messages are the primary content. Auxiliary profile/style/preview failures
  // must not make the entire room appear empty or unavailable.
  if (profileError) console.warn('room profile enrichment failed', profileError);
  if (replyError) console.warn('reply enrichment failed', replyError);
  if (assetError) console.warn('message asset enrichment failed', assetError);
  if (storyError) console.warn('story enrichment failed', storyError);
  if (storyBlockError) console.warn('story block enrichment failed', storyBlockError);
  if (styleError) console.warn('chat style enrichment failed', styleError);
  const styleByUserId=new Map<string,{bubbleColor:string;textColor:string}>(((styleRows??[]) as Array<{user_id:string;bubble_color:string;text_color:string}>).map((row)=>[row.user_id,{bubbleColor:row.bubble_color,textColor:row.text_color}]));

  const mergedProfileRows = profileRows ?? [];
  const snapshotAvatarPaths = messageRows
    .map((row) => row.sender_avatar_asset_path_snapshot as string | null)
    .filter((value): value is string => Boolean(value));
  const avatarPaths = [
    ...new Set([
      ...mergedProfileRows
        .map((row) => row.avatar_asset_path as string | null)
        .filter((value): value is string => Boolean(value)),
      ...snapshotAvatarPaths,
    ]),
  ];
  const avatarUrlByPath = await getCachedSignedUrls('profile-avatars', avatarPaths)
    .catch(() => new Map<string, string>());

  const assetPaths = (assetRows ?? [])
    .map((row) => row.storage_path as string | null)
    .filter((value): value is string => Boolean(value));
  const imageUrlByPath = await getCachedSignedUrls('chat-media', assetPaths)
    .catch(() => new Map<string, string>());

  const profileByUserId = new Map(
    mergedProfileRows.map((row) => [
      row.user_id as string,
      {
        name: String(row.display_name ?? '').trim() || '멤버',
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
      String(row.sender_display_name_snapshot ?? '').trim()
        || (row.sender_user_id ? profileByUserId.get(row.sender_user_id as string)?.name : undefined)
        || '멤버',
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
  const storyImageUrlByPath = await getCachedSignedUrls('chat-media', storyImagePaths)
    .catch(() => new Map<string, string>());
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
    senderDeletedAt: (row.sender_deleted_at as string | null) ?? null,
    replyToMessageId: row.reply_to_message_id as string | null,
    replyToBody: row.reply_to_message_id ? replyById.get(row.reply_to_message_id as string) : undefined,
    replyToSenderName: row.reply_to_message_id ? replySenderNameById.get(row.reply_to_message_id as string) : undefined,
    secretRecipientUserId: row.secret_recipient_user_id as string | null,
    senderName: row.sender_user_id
      ? (String(row.sender_display_name_snapshot ?? '').trim()
        || profileByUserId.get(row.sender_user_id as string)?.name)
      : (String(row.sender_display_name_snapshot ?? '').trim() || undefined),
    senderAvatarUrl: row.sender_avatar_asset_path_snapshot
      ? avatarUrlByPath.get(row.sender_avatar_asset_path_snapshot as string)
      : row.sender_user_id
        ? profileByUserId.get(row.sender_user_id as string)?.avatarUrl
        : undefined,
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

export async function getLatestRoomMessageCursor(roomId: string) {
  const { data, error } = await requireClient()
    .from('messages')
    .select('id,created_at')
    .eq('room_id', roomId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { id: data.id as string, createdAt: data.created_at as string }
    : null;
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
