import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type MediaPurpose = 'room-cover' | 'chat' | 'story' | 'profile-avatar';

type UploadInput = {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  fileSize: number;
  bytes?: ArrayBuffer;
  width: number;
  height: number;
  purpose: MediaPurpose;
  roomId?: string;
};

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase environment variables are not configured.');
  }
  return supabase;
}

function extensionFor(mimeType: UploadInput['mimeType']) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }[mimeType];
}

export async function uploadValidatedImage(input: UploadInput) {
  if (input.purpose === 'profile-avatar' && input.mimeType === 'image/gif') {
    throw new Error('GIF is not allowed for profile avatars.');
  }

  const client = requireClient();
  let bytes = input.bytes;
  if (!bytes) {
    const response = await fetch(input.uri);
    if (!response.ok) throw new Error(`MEDIA_FILE_READ_FAILED:${response.status}`);
    bytes = await response.arrayBuffer();
  }
  const byteSize = bytes.byteLength;
  const bucket = input.purpose === 'room-cover'
    ? 'room-covers'
    : input.purpose === 'chat' || input.purpose === 'story'
      ? 'chat-media'
      : 'profile-avatars';
  const { data: ticketRows, error: ticketError } = await client.rpc('begin_media_upload', {
    p_bucket_id: bucket,
      p_room_id: input.roomId ?? null,
    p_extension: extensionFor(input.mimeType),
    p_mime_type: input.mimeType,
    p_byte_size: byteSize,
    p_width: input.width,
    p_height: input.height,
  });
  if (ticketError) throw ticketError;

  const ticket = Array.isArray(ticketRows) ? ticketRows[0] : ticketRows;
  if (!ticket) throw new Error('Failed to create an upload ticket.');

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(ticket.object_path, bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: validationError } = await client.functions.invoke('validate-media', {
    body: { uploadId: ticket.upload_id },
  });
  if (validationError) {
    throw new Error(`MEDIA_VALIDATION_FAILED: ${validationError.message}`);
  }
  if (!data?.valid) throw new Error('MEDIA_VALIDATION_REJECTED');

  return data as {
    valid: true;
    uploadId: string;
    bucket: string;
    path: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  };
}

export async function sendUploadedImages(input: {
  roomId: string;
  uploadIds: string[];
  replyToMessageId?: string;
}) {
  const { data, error } = await requireClient().rpc('send_image_message', {
    p_room_id: input.roomId,
    p_upload_ids: input.uploadIds,
    p_reply_to_message_id: input.replyToMessageId ?? null,
  });
  if (error) throw error;
  const messageId = Array.isArray(data) ? data[0] : data;
  if (typeof messageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(messageId))
    throw new Error('MESSAGE_SEND_INVALID_RESPONSE');
  const { schedulePendingPushDispatch } = await import('./notifications');
  schedulePendingPushDispatch();
  return messageId;
}
