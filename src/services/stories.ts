import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type StoryBlockInput =
  | { type: 'text'; text: string }
  | { type: 'image'; uploadId?: string; storagePath?: string; mimeType?: string; uri?: string };

export type ServerStory = {
  id: string;
  roomId: string;
  roomName: string;
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
  const { data, error } = await requireClient().rpc('create_story_v2', {
    p_room_id: input.roomId,
    p_visibility: input.visibility,
    p_title: input.title,
    p_blocks: input.blocks,
  });
  if (error) throw error;
  return data as string;
}

export async function addStoryComment(storyId: string, body: string) {
  const { data, error } = await requireClient().rpc('add_story_comment', {
    p_story_id: storyId,
    p_body: body,
  });
  if (error) throw error;
  return data as string;
}

export async function updateStoryContent(storyId: string, title: string, blocks: StoryBlockInput[], visibility?: 'room' | 'public') {
  const { error } = await requireClient().rpc('update_story_content_v2', {
    p_story_id: storyId,
    p_visibility: visibility ?? null,
    p_title: title,
    p_blocks: blocks,
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

export async function listStories(input: { roomId?: string; publicOnly?: boolean; limit?: number }) {
  const client = requireClient();
  let storyQuery = client
    .from('stories')
    .select('id,room_id,author_user_id,visibility,title,created_at,view_count,heart_count')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 50);
  if (input.roomId) storyQuery = storyQuery.eq('room_id', input.roomId);
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
    client.from('story_blocks').select('story_id,block_type,text_content,storage_path,mime_type,position').in('story_id', storyIds).order('position'),
    client.from('story_comments').select('id,story_id,author_user_id,body,created_at').in('story_id', storyIds).is('deleted_at', null).order('created_at'),
    client.from('rooms').select('id,name').in('id', roomIds),
    client.from('room_profiles').select('room_id,user_id,display_name,avatar_asset_path').in('room_id', roomIds),
    client.from('story_likes').select('story_id').in('story_id', storyIds),
  ]);
  if (blockError) throw blockError;
  if (commentError) throw commentError;
  if (roomError) throw roomError;
  if (profileError && !input.publicOnly) throw profileError;

  const imagePaths = (blockRows ?? []).flatMap((row) => row.storage_path ? [row.storage_path as string] : []);
  const signedByPath = new Map<string, string>();
  if (imagePaths.length) {
    const { data: signedRows, error: signedError } = await client.storage.from('chat-media').createSignedUrls(imagePaths, 3600);
    if (signedError) throw signedError;
    signedRows?.forEach((row, index) => {
      if (row.signedUrl) signedByPath.set(imagePaths[index], row.signedUrl);
    });
  }

  const avatarPaths = (profileRows ?? [])
    .map((row) => row.avatar_asset_path as string | null)
    .filter((value): value is string => Boolean(value));
  const signedAvatarByPath = new Map<string, string>();
  if (avatarPaths.length) {
    const { data: signedAvatarRows, error: signedAvatarError } = await client.storage.from('profile-avatars').createSignedUrls(avatarPaths, 3600);
    if (signedAvatarError) throw signedAvatarError;
    signedAvatarRows?.forEach((row, index) => {
      if (row.signedUrl) signedAvatarByPath.set(avatarPaths[index], row.signedUrl);
    });
  }

  const profileFor = (roomId: string, userId: string | null) =>
    profileRows?.find((row) => row.room_id === roomId && row.user_id === userId);
  const profileName = (roomId: string, userId: string | null) =>
    profileFor(roomId, userId)?.display_name ?? '멤버';
  const profileAvatar = (roomId: string, userId: string | null) => {
    const path = profileFor(roomId, userId)?.avatar_asset_path as string | null | undefined;
    return path ? signedAvatarByPath.get(path) : undefined;
  };

  return storyRows.map((story) => ({
    id: story.id,
    roomId: story.room_id,
    roomName: roomRows?.find((room) => room.id === story.room_id)?.name ?? '채팅방',
    title: story.title,
    author: profileName(story.room_id, story.author_user_id),
    authorAvatarUrl: profileAvatar(story.room_id, story.author_user_id),
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
      author: profileName(story.room_id, comment.author_user_id),
      authorAvatarUrl: profileAvatar(story.room_id, comment.author_user_id),
      authorUserId: comment.author_user_id,
      body: comment.body,
      createdAt: comment.created_at,
    })),
  })) as ServerStory[];
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
