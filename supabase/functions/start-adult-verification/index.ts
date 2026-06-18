import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: userData } = await client.auth.getUser();
    if (!userData.user) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    const providerUrl = Deno.env.get('ADULT_VERIFICATION_START_URL');
    if (!providerUrl) return Response.json({ error: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 });
    const body = await request.json().catch(() => ({}));
    const url = new URL(providerUrl);
    url.searchParams.set('user_id', userData.user.id);
    url.searchParams.set('return_url', body.returnUrl ?? 'mute://adult-verification-complete');
    return Response.json({ url: url.toString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }, { status: 500 });
  }
});
