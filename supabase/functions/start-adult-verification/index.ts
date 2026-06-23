import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? '';
}

function boolish(value: string) {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

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
    const body = await request.json().catch(() => ({}));
    const returnUrl =
      (typeof body.returnUrl === 'string' && body.returnUrl.trim())
      || env('OPERATIONS_POLICY_PORTAL_URL')
      || 'mute://adult-verification-complete';
    const providerUrl = env('ADULT_VERIFICATION_START_URL');
    const callbackSecret = env('ADULT_VERIFICATION_CALLBACK_SECRET');
    const testMode = boolish(env('ADULT_VERIFICATION_TEST_MODE'));

    if (!providerUrl) {
      if (!testMode || !callbackSecret) {
        return Response.json({ error: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 });
      }
      const callbackUrl = new URL(`${env('SUPABASE_URL')}/functions/v1/adult-verification-callback`);
      callbackUrl.searchParams.set('token', callbackSecret);
      callbackUrl.searchParams.set('user_id', userData.user.id);
      callbackUrl.searchParams.set('adult_verified', '1');
      callbackUrl.searchParams.set('provider', 'mock-adult-verification');
      callbackUrl.searchParams.set('return_url', returnUrl);
      return Response.json({
        url: callbackUrl.toString(),
        mode: 'mock',
      });
    }

    const url = new URL(providerUrl);
    url.searchParams.set('user_id', userData.user.id);
    url.searchParams.set('return_url', returnUrl);
    return Response.json({ url: url.toString() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }, { status: 500 });
  }
});
