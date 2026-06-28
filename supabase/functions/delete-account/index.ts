import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type OwnedUpload = {
  bucket_id: 'room-covers' | 'chat-media' | 'profile-avatars';
  object_path: string;
  status: 'pending' | 'validated' | 'rejected' | 'deleted';
};

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
    await removePrivateAccountUploads(adminClient, userData.user.id);

    const { data: blockedUntil, error: prepareError } = await userClient.rpc('prepare_account_deletion');
    if (prepareError) throw prepareError;

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
    if (deleteError) throw deleteError;

    return Response.json({ blockedUntil }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
