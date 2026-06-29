import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const expectedAdUnits = new Set(
  (Deno.env.get('ADMOB_REWARDED_AD_UNIT_IDS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => [value, value.split('/').at(-1) ?? value]),
);
const keyEndpoint = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let cachedKeys: { expiresAt: number; keys: Map<string, CryptoKey> } | null = null;

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function readDerLength(bytes: Uint8Array, offset: number) {
  const first = bytes[offset];
  if (first < 0x80) return { length: first, offset: offset + 1 };
  const count = first & 0x7f;
  let length = 0;
  for (let index = 0; index < count; index += 1)
    length = (length << 8) | bytes[offset + 1 + index];
  return { length, offset: offset + 1 + count };
}

function derSignatureToRaw(der: Uint8Array, componentSize = 32) {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error('INVALID_DER_SEQUENCE');
  const sequence = readDerLength(der, offset);
  offset = sequence.offset;
  if (der[offset++] !== 0x02) throw new Error('INVALID_DER_R');
  const rLength = readDerLength(der, offset);
  offset = rLength.offset;
  let r = der.slice(offset, offset + rLength.length);
  offset += rLength.length;
  if (der[offset++] !== 0x02) throw new Error('INVALID_DER_S');
  const sLength = readDerLength(der, offset);
  offset = sLength.offset;
  let s = der.slice(offset, offset + sLength.length);
  while (r.length > componentSize && r[0] === 0) r = r.slice(1);
  while (s.length > componentSize && s[0] === 0) s = s.slice(1);
  if (r.length > componentSize || s.length > componentSize)
    throw new Error('INVALID_DER_COMPONENT');
  const raw = new Uint8Array(componentSize * 2);
  raw.set(r, componentSize - r.length);
  raw.set(s, componentSize * 2 - s.length);
  return raw;
}

async function getVerificationKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetch(keyEndpoint);
  if (!response.ok) throw new Error('ADMOB_KEYS_UNAVAILABLE');
  const payload = await response.json() as {
    keys?: Array<{ keyId?: number | string; base64?: string; pem?: string }>;
  };
  const keys = new Map<string, CryptoKey>();
  for (const item of payload.keys ?? []) {
    const encoded = item.base64 ?? item.pem
      ?.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, '');
    if (item.keyId == null || !encoded) continue;
    const key = await crypto.subtle.importKey(
      'spki',
      decodeBase64Url(encoded),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    keys.set(String(item.keyId), key);
  }
  if (!keys.size) throw new Error('ADMOB_KEYS_EMPTY');
  cachedKeys = { expiresAt: Date.now() + 6 * 60 * 60 * 1000, keys };
  return keys;
}

async function verifyCallback(request: Request) {
  const rawQuery = request.url.split('?')[1] ?? '';
  const signatureMarker = '&signature=';
  const signatureIndex = rawQuery.indexOf(signatureMarker);
  if (signatureIndex < 0) throw new Error('ADMOB_SIGNATURE_MISSING');
  const signedContent = rawQuery.slice(0, signatureIndex);
  const params = new URL(request.url).searchParams;
  const signature = params.get('signature');
  const keyId = params.get('key_id');
  if (!signature || !keyId) throw new Error('ADMOB_SIGNATURE_MISSING');
  const key = (await getVerificationKeys()).get(keyId);
  if (!key) throw new Error('ADMOB_KEY_UNKNOWN');
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    derSignatureToRaw(decodeBase64Url(signature)),
    new TextEncoder().encode(signedContent),
  );
}

Deno.serve(async (request) => {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const sessionId = params.get('custom_data');
    const userId = params.get('user_id');
    const transactionId = params.get('transaction_id');
    const adUnit = params.get('ad_unit');
    const rawTimestamp = Number(params.get('timestamp'));

    // This value is configured only in AdMob's URL ownership test. It never
    // grants a reward and is intentionally handled before production fields.
    if (userId === 'admob-url-verification' && sessionId === 'admob-url-verification')
      return Response.json({ ok: true, verification: true });

    const timestamp = rawTimestamp > 100_000_000_000_000
      ? Math.floor(rawTimestamp / 1000)
      : rawTimestamp;
    if (!sessionId || !userId || !transactionId || !adUnit || !Number.isFinite(timestamp))
      return new Response('Bad Request', { status: 400 });
    if (Math.abs(Date.now() - timestamp) > 30 * 60 * 1000)
      return new Response('Expired callback', { status: 400 });
    if (!(await verifyCallback(request)))
      return new Response('Invalid signature', { status: 401 });

    if (!expectedAdUnits.size || !expectedAdUnits.has(adUnit))
      return new Response('Unknown ad unit', { status: 403 });

    const { data, error } = await supabase.rpc('grant_verified_rewarded_ad', {
      p_session_id: sessionId,
      p_user_id: userId,
      p_transaction_id: transactionId,
      p_ad_unit: adUnit,
    });
    if (error) return new Response(error.message, { status: 400 });
    return Response.json({ ok: true, result: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Verification failed', {
      status: 400,
    });
  }
});
