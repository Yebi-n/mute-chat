import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ciHash(ci: string) {
  const salt = Deno.env.get('ADULT_VERIFICATION_CI_SALT')?.trim();
  if (!salt || !ci) return null;
  return sha256(`${salt}:${ci}`);
}

function boolish(value: string | null) {
  if (!value) return false;
  return ['1', 'true', 'ok', 'success', 'verified', 'adult'].includes(value.toLowerCase());
}

function buildDefaultReturnUrl() {
  const portalUrl = Deno.env.get('OPERATIONS_POLICY_PORTAL_URL')?.trim();
  if (portalUrl) {
    return `${portalUrl}${portalUrl.includes('?') ? '&' : '?'}verified=1`;
  }
  return `${env('SUPABASE_URL')}/functions/v1/operations-policy?verified=1`;
}

Deno.serve(async (request) => {
  try {
    const url = new URL(request.url);
    const params = request.method === 'POST'
      ? new URLSearchParams(await request.text())
      : url.searchParams;

    const callbackSecret = env('ADULT_VERIFICATION_CALLBACK_SECRET');
    const suppliedSecret =
      request.headers.get('x-callback-secret')?.trim()
      ?? params.get('token')?.trim()
      ?? '';

    if (suppliedSecret !== callbackSecret) {
      return new Response('UNAUTHORIZED', { status: 401 });
    }

    const userId = params.get('user_id')?.trim();
    const returnUrl = params.get('return_url')?.trim() || buildDefaultReturnUrl();
    const provider = params.get('provider')?.trim() || 'web-verification';
    const ci = params.get('ci')?.trim() || '';
    const adultVerified = boolish(params.get('adult_verified') ?? params.get('verified') ?? params.get('adult'));

    if (!userId) {
      return new Response('MISSING_USER_ID', { status: 400 });
    }
    if (!adultVerified) {
      return Response.redirect(`${returnUrl}${returnUrl.includes('?') ? '&' : '?'}verified=0`, 302);
    }

    const service = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const hashedCi = await ciHash(ci);

    const updatePayload: Record<string, string | boolean | null> = {
      identity_verified_at: new Date().toISOString(),
      adult_verified_at: new Date().toISOString(),
      identity_provider: provider,
      adult_content_web_opt_in_at: new Date().toISOString(),
      ios_adult_content_enabled: true,
    };
    if (hashedCi) updatePayload.ci_hash = hashedCi;

    const { error } = await service.from('users').update(updatePayload).eq('id', userId);
    if (error) throw error;

    return Response.redirect(`${returnUrl}${returnUrl.includes('?') ? '&' : '?'}verified=1`, 302);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'UNKNOWN_ERROR', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
});
