import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function detectedMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith('GIF87a') || header.startsWith('GIF89a')) return 'image/gif';
  if (header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

Deno.serve(async (request) => {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return new Response('Unauthorized', { status: 401 });

  const { uploadId } = await request.json();
  const { data: upload, error: uploadError } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('id', uploadId)
    .eq('owner_user_id', authData.user.id)
    .eq('status', 'pending')
    .single();
  if (uploadError || !upload) return new Response('Upload not found', { status: 404 });

  const { data: file, error: downloadError } = await supabase.storage
    .from(upload.bucket_id)
    .download(upload.object_path);
  if (downloadError || !file) return new Response('Object not found', { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectedMime(bytes);
  const allowed = mime === upload.expected_mime_type &&
    bytes.byteLength === upload.expected_byte_size &&
    !(upload.bucket_id === 'profile-avatars' && mime === 'image/gif') &&
    !(mime === 'image/gif' && bytes.byteLength > 5 * 1024 * 1024);

  if (!allowed) {
    await supabase.storage.from(upload.bucket_id).remove([upload.object_path]);
    await supabase.from('media_uploads').update({
      status: 'rejected',
      rejection_reason: 'SIGNATURE_OR_SIZE_MISMATCH',
      validated_at: new Date().toISOString(),
    }).eq('id', upload.id);
    return Response.json({ valid: false }, { status: 422 });
  }

  await supabase.from('media_uploads').update({
    status: 'validated',
    rejection_reason: null,
    validated_at: new Date().toISOString(),
  }).eq('id', upload.id);
  return Response.json({
    valid: true,
    uploadId: upload.id,
    bucket: upload.bucket_id,
    path: upload.object_path,
    mimeType: mime,
    byteSize: bytes.byteLength,
    width: upload.expected_width,
    height: upload.expected_height,
  });
});
