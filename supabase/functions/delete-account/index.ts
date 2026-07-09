import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

type OwnedUpload = {
  bucket_id: 'room-covers' | 'chat-media' | 'profile-avatars';
  object_path: string;
  status: 'pending' | 'validated' | 'rejected' | 'deleted';
};

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const parts = ['message', 'code', 'details', 'hint', 'name']
      .map((key) => record[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (parts.length > 0) return parts.join(' / ');
    try {
      const json = JSON.stringify(record);
      if (json && json !== '{}') return json;
    } catch {
      // Fall through to the stable fallback below.
    }
  }
  return 'ACCOUNT_DELETION_FAILED';
}

async function removePrivateAccountUploads(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await adminClient
    .from('media_uploads')
    .select('bucket_id,object_path,status')
    .eq('owner_user_id', userId);
  if (error) throw error;

  const uploads = (data ?? []) as OwnedUpload[];
  const removable = uploads.filter(
    (upload) => upload.bucket_id === 'profile-avatars' || upload.status !== 'validated',
  );
  for (const bucket of ['room-covers', 'chat-media', 'profile-avatars'] as const) {
    const paths = removable
      .filter((upload) => upload.bucket_id === bucket)
      .map((upload) => upload.object_path);
    for (let index = 0; index < paths.length; index += 100) {
      const { error: removeError } = await adminClient.storage
        .from(bucket)
        .remove(paths.slice(index, index + 100));
      if (removeError) throw removeError;
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) throw new Error('AUTH_REQUIRED');

    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceRoleKey) throw new Error('SERVER_CONFIG_ERROR');

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw userError ?? new Error('AUTH_REQUIRED');

    const adminClient = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    try {
      await removePrivateAccountUploads(adminClient, userData.user.id);
    } catch (cleanupError) {
      console.warn('delete-account upload cleanup skipped', describeError(cleanupError), cleanupError);
    }

    const { data: blockedUntil, error: deleteError } = await adminClient.rpc(
      'delete_my_account_admin',
      { p_user_id: userData.user.id },
    );
    if (deleteError) throw deleteError;

    return jsonResponse({ ok: true, blockedUntil });
  } catch (error) {
    const message = describeError(error);
    console.error('delete-account failed', message, error);
    return jsonResponse({ ok: false, error: message, message, code: 'ACCOUNT_DELETION_FAILED' });
  }
});
