import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { schedulePendingPushDispatch } from './notifications';
import { getCachedSignedUrls } from './signedUrls';

export type StoryBlockInput =
  | { type: 'text'; text: string }
  | { type: 'image'; uploadId?: string; storagePath?: string; mimeType?: string; uri?: string };

export type ServerStory = {
  id: string;
  roomId: string;
  roomName: string;
  roomCoverUrl?: string;
  title: string;
  author: string;
  authorAvatarUrl?: string;
  authorUserId: string | null;
  createdAt: string;
  visibility: 'room' | 'public';
  viewCount: number;
  heartCount: number;
  liked: boolean;
  blocks: ({ type: 'text'; text: string } | { type: 'image'; uri: string; storagePath: string; mimeType: string })[];
  comments: { id: string; author: string; authorAvatarUrl?: string; authorUserId: string | null; body: string; createdAt: string }[];
};

export async function createStory(input: {
  roomId: string;
  visibility: 'room' | 'public';
  title: string;
  body: string;
}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  const { data, error } = await supabase.rpc('create_story', {
    p_room_id: input.roomId,
    p_visibility: input.visibility,
    p_title: input.title,
    p_body: input.body,
  });
  if (error) throw error;
  schedulePendingPushDispatch();
  return data as string;
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export async function createStoryWithBlocks(input: {
  roomId: string;
  visibility: 'room' | 'public';
  title: string;
  blocks: StoryBlockInput[];
}) {
  const blocks = input.blocks.filter((block) =>
    block.type === 'text'
      ? block.text.trim().length > 0
      : Boolean(block.uploadId || block.storagePath),
  );
  const { data, error } = await requireClient().rpc('create_story_v2', {
    p_room_id: input.roomId,
    p_visibility: input.visibility,
    p_title: input.title,
    p_blocks: blocks,
  });
  if (error) throw error;
  schedulePendingPushDispatch();
  return data as string;
}

export async function addStoryComment(storyId: string, body: string) {
  const { data, error } = await requireClient().rpc('add_story_comment', {
    p_story_id: storyId,
    p_body: body,
  });
  if (error) throw error;
  schedulePendingPushDispatch();
  return data as string;
}

export async function updateStoryContent(storyId: string, title: string, blocks: StoryBlockInput[], visibility?: 'room' | 'public') {
  const normalizedBlocks = blocks.filter((block) =>
    block.type === 'text'
      ? block.text.trim().length > 0
      : Boolean(block.uploadId || block.storagePath),
  );
  const { error } = await requireClient().rpc('update_story_content_v2', {
    p_story_id: storyId,
    p_visibility: visibility ?? null,
    p_title: title,
    p_blocks: normalizedBlocks,
  });
  if (error) throw error;
}

export async function deleteStory(storyId: string) {
  const { error } = await requireClient().rpc('delete_story', {
    p_story_id: storyId,
  });
  if (error) throw error;
}

export async function deleteStoryComment(commentId: string) {
  const { error } = await requireClient().rpc('delete_story_comment', {
    p_comment_id: commentId,
  });
  if (error) throw error;
}

export async function listStories(input: { roomId?: string; storyId?: string; publicOnly?: boolean; limit?: number }) {
  const client = requireClient();
    let storyQuery = client
      .from('stories')
      .select('id,room_id,author_user_id,visibility,title,created_at,view_count,heart_count,author_name,author_avatar_asset_path')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50);
  if (input.roomId) storyQuery = storyQuery.eq('room_id', input.roomId);
  if (input.storyId) storyQuery = storyQuery.eq('id', input.storyId);
  if (input.publicOnly) storyQuery = storyQuery.eq('visibility', 'public');
  const { data: storyRows, error: storyError } = await storyQuery;
  if (storyError) throw storyError;
  if (!storyRows?.length) return [] as ServerStory[];

  const storyIds = storyRows.map((row) => row.id);
  const roomIds = [...new Set(storyRows.map((row) => row.room_id))];
  const [
    { data: blockRows, error: blockError },
    { data: commentRows, error: commentError },
    { data: roomRows, error: roomError },
    { data: profileRows, error: profileError },
    { data: likeRows },
  ] = await Promise.all([
    client.from('story_blocks').select('story_id,block_type,text_content,storage_path,mime_type,position').in('story_id', storyIds).order('position').limit(1000),
    client.from('story_comments').select('id,story_id,author_user_id,body,created_at,author_name,author_avatar_asset_path').in('story_id', storyIds).is('deleted_at', null).order('created_at').limit(500),
    client.from('rooms').select('id,name,description,category,region,max_members,visibility,cover_asset_path,created_at,updated_at').in('id', roomIds),
    client.from('room_profiles').select('room_id,user_id,display_name,avatar_asset_path').in('room_id', roomIds),
    client.from('story_likes').select('story_id').in('story_id', storyIds),
  ]);
  if (blockError) throw blockError;
  if (commentError) throw commentError;
  if (roomError) throw roomError;
  if (profileError && !input.publicOnly) throw profileError;

  const imagePaths = (blockRows ?? []).flatMap((row) => row.storage_path ? [row.storage_path as string] : []);
  const signedByPath = await getCachedSignedUrls('chat-media', imagePaths)
    .catch(() => new Map<string, string>());

  const roomCoverPaths = (roomRows ?? [])
    .map((row) => row.cover_asset_path as string | null)
    .filter((value): value is string => Boolean(value));
  const signedRoomCoverByPath = await getCachedSignedUrls('room-covers', roomCoverPaths)
    .catch(() => new Map<string, string>());

  const avatarPaths = [
    ...(profileRows ?? []).map((row) => row.avatar_asset_path as string | null),
    ...(storyRows ?? []).map((row) => row.author_avatar_asset_path as string | null),
    ...(commentRows ?? []).map((row) => row.author_avatar_asset_path as string | null),
  ]
    .filter((value): value is string => Boolean(value));
  const signedAvatarByPath = await getCachedSignedUrls('profile-avatars', avatarPaths)
    .catch(() => new Map<string, string>());

  const profileFor = (roomId: string, userId: string | null) =>
    profileRows?.find((row) => row.room_id === roomId && row.user_id === userId);
  const fallbackProfileName = (name: unknown) =>
    typeof name === 'string' && name.trim().length ? name : '멤버';
  const profileName = (roomId: string, userId: string | null, fallbackName?: unknown) =>
    profileFor(roomId, userId)?.display_name ?? fallbackProfileName(fallbackName);
  const profileAvatar = (roomId: string, userId: string | null, fallbackPath?: unknown) => {
    const path = profileFor(roomId, userId)?.avatar_asset_path as string | null | undefined;
    if (path) return signedAvatarByPath.get(path);
    if (typeof fallbackPath === 'string' && fallbackPath.trim().length) {
      return signedAvatarByPath.get(fallbackPath);
    }
    return undefined;
  };

  return storyRows.map((story) => {
    const room = roomRows?.find((item) => item.id === story.room_id);
    return {
      id: story.id,
      roomId: story.room_id,
      roomName: room?.name ?? '???',
      roomCoverUrl: room?.cover_asset_path
        ? signedRoomCoverByPath.get(room.cover_asset_path as string)
        : undefined,
      title: story.title,
      author: profileName(story.room_id, story.author_user_id, story.author_name),
      authorAvatarUrl: profileAvatar(story.room_id, story.author_user_id, story.author_avatar_asset_path),
      authorUserId: story.author_user_id,
      createdAt: story.created_at,
      visibility: story.visibility,
      viewCount: story.view_count ?? 0,
      heartCount: story.heart_count ?? 0,
      liked: Boolean(likeRows?.some((like) => like.story_id === story.id)),
      blocks: (blockRows ?? []).filter((block) => block.story_id === story.id).map((block) =>
        block.block_type === 'text'
          ? { type: 'text' as const, text: block.text_content ?? '' }
          : {
              type: 'image' as const,
              uri: signedByPath.get(block.storage_path ?? '') ?? '',
              storagePath: block.storage_path ?? '',
              mimeType: block.mime_type ?? 'image/jpeg',
            }),
      comments: (commentRows ?? []).filter((comment) => comment.story_id === story.id).map((comment) => ({
        id: comment.id,
        author: profileName(story.room_id, comment.author_user_id, comment.author_name),
        authorAvatarUrl: profileAvatar(story.room_id, comment.author_user_id, comment.author_avatar_asset_path),
        authorUserId: comment.author_user_id,
        body: comment.body,
        createdAt: comment.created_at,
      })),
    };
  }) as ServerStory[];
}

export async function recordStoryView(storyId: string) {
  const { data, error } = await requireClient().rpc('record_story_view', { p_story_id: storyId });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function toggleStoryLike(storyId: string) {
  const { data, error } = await requireClient().rpc('toggle_story_like', { p_story_id: storyId });
  if (error) throw error;
  return data as { liked: boolean; heartCount: number };
}
