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
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function ciHash(ci: string | null | undefined) {
  const salt = Deno.env.get('ADULT_VERIFICATION_CI_SALT')?.trim();
  if (!salt || !ci) return null;
  return sha256(`${salt}:${ci}`);
}

function normalizeBirthDate(value: unknown) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return raw;
}

function isAdultByBirthDate(value: unknown) {
  const birthDate = normalizeBirthDate(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 19;
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

function phoneDigits(value: unknown) {
  return normalizePhone(value).replace(/\D/g, '');
}

async function findUserByVerifiedPhone(
  service: ReturnType<typeof createClient>,
  verifiedPhone: string,
) {
  if (!phoneDigits(verifiedPhone)) return null;
  const { data, error } = await service.rpc('find_user_id_by_verified_phone', {
    p_phone: verifiedPhone,
  });
  if (error) throw error;
  return data ? { id: String(data) } : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  let attemptId = '';
  let service: ReturnType<typeof createClient> | null = null;
  try {
    const supabaseUrl = env('SUPABASE_URL');
    const body = await request.json().catch(() => ({}));
    attemptId = typeof body.identityVerificationId === 'string'
      ? body.identityVerificationId.trim()
      : '';
    if (!attemptId) return json({ error: 'MISSING_IDENTITY_VERIFICATION_ID' }, 400);

    service = createClient(supabaseUrl, env('SUPABASE_SERVICE_ROLE_KEY'));
    const authorization = request.headers.get('Authorization');
    let authedUserId = '';
    let authedUserPhone = '';
    if (authorization) {
      const authed = createClient(supabaseUrl, env('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: authorization } },
      });
      const { data: userData } = await authed.auth.getUser();
      if (userData.user) {
        authedUserId = userData.user.id;
        authedUserPhone = normalizePhone(userData.user.phone);
      }
    }

    const { data: attempt, error: attemptError } = await service
      .from('adult_verification_attempts')
      .select('id,user_id,status,expires_at')
      .eq('id', attemptId)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) return json({ error: 'VERIFICATION_ATTEMPT_NOT_FOUND' }, 404);
    if (attempt.status === 'completed') return json({ ok: true, adultVerified: true });
    if (attempt.status !== 'pending') return json({ error: 'VERIFICATION_ATTEMPT_INVALID' }, 409);
    if (new Date(attempt.expires_at).getTime() <= Date.now()) {
      await service.from('adult_verification_attempts').update({
        status: 'expired',
        failure_code: 'EXPIRED',
        updated_at: new Date().toISOString(),
      }).eq('id', attemptId);
      return json({ error: 'VERIFICATION_ATTEMPT_EXPIRED' }, 410);
    }

    const response = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(attemptId)}`,
      { headers: { Authorization: `PortOne ${env('PORTONE_API_SECRET')}` } },
    );
    if (!response.ok) {
      console.error('PortOne identity lookup failed', response.status, await response.text());
      return json({ error: 'PORTONE_LOOKUP_FAILED' }, 502);
    }

    const verification = await response.json();
    if (verification.status !== 'VERIFIED') {
      return json({ error: 'NOT_VERIFIED' }, 400);
    }

    const customer = verification.verifiedCustomer ?? {};
    if (!isAdultByBirthDate(customer.birthDate)) {
      await service.from('adult_verification_attempts').update({
        status: 'failed',
        failure_code: 'UNDER_AGE',
        updated_at: new Date().toISOString(),
      }).eq('id', attemptId);
      return json({ error: 'UNDER_AGE' }, 403);
    }

    const verifiedPhone = normalizePhone(customer.phoneNumber ?? customer.phone);
    const phoneMatchedUser = verifiedPhone
      ? await findUserByVerifiedPhone(service, verifiedPhone)
      : null;
    const targetUserId = phoneMatchedUser?.id || (authedUserId && attempt.user_id === authedUserId ? authedUserId : '');
    const accountPhone = authedUserPhone;
    if (!targetUserId) {
      await service.from('adult_verification_attempts').update({
        status: 'failed',
        failure_code: 'PHONE_ACCOUNT_NOT_FOUND',
        updated_at: new Date().toISOString(),
      }).eq('id', attemptId);
      return json({ error: 'PHONE_ACCOUNT_NOT_FOUND' }, 404);
    }
    if (verifiedPhone && accountPhone && verifiedPhone !== accountPhone && targetUserId === authedUserId) {
      await service.from('adult_verification_attempts').update({
        status: 'failed',
        failure_code: 'PHONE_MISMATCH',
        updated_at: new Date().toISOString(),
      }).eq('id', attemptId);
      return json({ error: 'PHONE_MISMATCH' }, 403);
    }

    const hashedCi = await ciHash(customer.ci);
    if (hashedCi) {
      const { data: duplicate } = await service
        .from('users')
        .select('id')
        .eq('ci_hash', hashedCi)
        .neq('id', targetUserId)
        .maybeSingle();
      if (duplicate) return json({ error: 'IDENTITY_ALREADY_USED' }, 409);
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, string | boolean> = {
      identity_verified_at: now,
      adult_verified_at: now,
      identity_provider: 'portone_kg_inicis',
      adult_content_web_opt_in_at: now,
      ios_adult_content_enabled: true,
      updated_at: now,
    };
    if (hashedCi) updatePayload.ci_hash = hashedCi;

    const { error: updateError } = await service.from('users').update(updatePayload).eq('id', targetUserId);
    if (updateError) {
      if (updateError.code === '23505') return json({ error: 'IDENTITY_ALREADY_USED' }, 409);
      throw updateError;
    }

    const { error: completionError } = await service
      .from('adult_verification_attempts')
      .update({ status: 'completed', completed_at: now, updated_at: now, failure_code: null })
      .eq('id', attemptId)
      .eq('status', 'pending');
    if (completionError) throw completionError;

    return json({ ok: true, adultVerified: true });
  } catch (error) {
    console.error('complete-adult-verification failed', error);
    if (service && attemptId) {
      await service.from('adult_verification_attempts').update({
        failure_code: 'SERVER_ERROR',
        updated_at: new Date().toISOString(),
      }).eq('id', attemptId).eq('status', 'pending');
    }
    return json({ error: error instanceof Error ? error.message : 'UNKNOWN_ERROR' }, 500);
  }
});
