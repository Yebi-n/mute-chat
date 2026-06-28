import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function env(name: string) {
  return Deno.env.get(name)?.trim() ?? '';
}

function requiredEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function boolish(value: string) {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function appendQuery(url: string, key: string, value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
}

function safeReturnUrl(candidate: unknown) {
  const portal = env('OPERATIONS_POLICY_PORTAL_URL');
  const requested = typeof candidate === 'string' ? candidate.trim() : '';
  if (!requested) return portal || 'mute://adult-verification-complete';
  if (requested === 'mute://adult-verification-complete') return requested;
  if (!portal) return requested;

  try {
    const requestedUrl = new URL(requested);
    const portalUrl = new URL(portal);
    if (requestedUrl.origin === portalUrl.origin) return requested;
  } catch {
    // Fall back to the configured portal below.
  }
  return portal;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'UNAUTHORIZED' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const authed = createClient(supabaseUrl, requiredEnv('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json({ error: 'UNAUTHORIZED' }, 401);

    const body = await request.json().catch(() => ({}));
    const returnUrl = safeReturnUrl(body.returnUrl);
    const providerUrl = env('ADULT_VERIFICATION_START_URL');
    const callbackSecret = env('ADULT_VERIFICATION_CALLBACK_SECRET');
    const testMode = boolish(env('ADULT_VERIFICATION_TEST_MODE'));
    const portoneStoreId = env('PORTONE_STORE_ID');
    const portoneChannelKey = env('PORTONE_IDENTITY_CHANNEL_KEY');

    if (portoneStoreId && portoneChannelKey) {
      const service = createClient(supabaseUrl, requiredEnv('SUPABASE_SERVICE_ROLE_KEY'));
      const identityVerificationId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await service
        .from('adult_verification_attempts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('user_id', userData.user.id)
        .eq('status', 'pending');

      const { error: insertError } = await service
        .from('adult_verification_attempts')
        .insert({
          id: identityVerificationId,
          user_id: userData.user.id,
          provider: 'portone_kg_inicis',
          status: 'pending',
          return_url: returnUrl,
          expires_at: expiresAt,
        });
      if (insertError) throw insertError;

      return json({
        mode: 'portone',
        storeId: portoneStoreId,
        channelKey: portoneChannelKey,
        identityVerificationId,
        redirectUrl: appendQuery(returnUrl, 'identityVerificationId', identityVerificationId),
        expiresAt,
      });
    }

    if (!providerUrl) {
      if (!testMode || !callbackSecret) {
        return json({ error: 'PROVIDER_NOT_CONFIGURED' }, 503);
      }
      const callbackUrl = new URL(`${supabaseUrl}/functions/v1/adult-verification-callback`);
      callbackUrl.searchParams.set('token', callbackSecret);
      callbackUrl.searchParams.set('user_id', userData.user.id);
      callbackUrl.searchParams.set('adult_verified', '1');
      callbackUrl.searchParams.set('provider', 'mock-adult-verification');
      callbackUrl.searchParams.set('return_url', returnUrl);
      return json({ url: callbackUrl.toString(), mode: 'mock' });
    }

    const url = new URL(providerUrl);
    url.searchParams.set('user_id', userData.user.id);
    url.searchParams.set('return_url', returnUrl);
    return json({ url: url.toString(), mode: 'legacy' });
  } catch (error) {
    console.error('start-adult-verification failed', error);
    return json({ error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }, 500);
  }
});
