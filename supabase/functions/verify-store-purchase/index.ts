import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const pointProducts: Record<string, number> = {
  mute_points_5000: 5000,
  mute_points_11000: 11000,
  mute_points_28000: 28000,
  mute_points_60000: 60000,
  mute_points_200000: 200000,
  mute_points_390000: 390000,
};
const themeProducts = new Set([
  'mute_theme_white',
  'mute_theme_mint',
  'mute_theme_ocean',
  'mute_theme_lavender',
  'mute_theme_sunset',
  'mute_theme_mono',
  'mute_theme_dark',
]);
const adFreeProduct = 'mute_ad_free_monthly';

function base64Url(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64UrlJson<T>(value: string): T {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function createAppleToken() {
  const keyId = Deno.env.get('APP_STORE_IAP_KEY_ID');
  const issuerId = Deno.env.get('APP_STORE_ISSUER_ID');
  const bundleId = Deno.env.get('APP_STORE_BUNDLE_ID') ?? 'app.mute.chat';
  const privateKey = Deno.env.get('APP_STORE_IAP_PRIVATE_KEY');
  if (!keyId || !issuerId || !privateKey) throw new Error('APP_STORE_API_NOT_CONFIGURED');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 900,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  };
  const body = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const pem = privateKey
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const raw = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(body),
  ));
  return `${body}.${base64Url(signature)}`;
}

async function fetchAppleTransaction(transactionId: string) {
  const token = await createAppleToken();
  const paths = [
    ['production', `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`],
    ['sandbox', `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/transactions/${transactionId}`],
  ] as const;
  for (const [environment, url] of paths) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (response.ok) {
      const payload = await response.json();
      const signed = payload?.signedTransactionInfo;
      if (typeof signed !== 'string') throw new Error('APPLE_TRANSACTION_MISSING_JWS');
      return {
        environment,
        signedTransactionInfo: signed,
        transaction: decodeBase64UrlJson<Record<string, unknown>>(signed.split('.')[1]),
        raw: payload,
      };
    }
    if (![400, 401, 403, 404].includes(response.status)) break;
  }
  throw new Error('APPLE_TRANSACTION_NOT_FOUND');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer '))
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: cors });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: authData, error: authError } = await service.auth.getUser(
    authorization.slice('Bearer '.length),
  );
  if (authError || !authData.user)
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: cors });

  const { productId, transactionId, platform } = await request.json().catch(() => ({}));
  if (typeof productId !== 'string' || typeof transactionId !== 'string')
    return Response.json({ error: 'INVALID_PURCHASE' }, { status: 400, headers: cors });
  if (!(productId in pointProducts) && !themeProducts.has(productId) && productId !== adFreeProduct)
    return Response.json({ error: 'UNSUPPORTED_PRODUCT' }, { status: 400, headers: cors });
  if (platform !== 'ios')
    return Response.json({ error: 'STORE_PLATFORM_NOT_SUPPORTED_YET' }, { status: 400, headers: cors });

  try {
    const bundleId = Deno.env.get('APP_STORE_BUNDLE_ID') ?? 'app.mute.chat';
    const verified = await fetchAppleTransaction(transactionId);
    const tx = verified.transaction;
    if (tx.bundleId !== bundleId) throw new Error('BUNDLE_ID_MISMATCH');
    if (tx.productId !== productId) throw new Error('PRODUCT_ID_MISMATCH');
    if (String(tx.transactionId) !== transactionId) throw new Error('TRANSACTION_ID_MISMATCH');
    if (tx.revocationDate) throw new Error('TRANSACTION_REVOKED');

    let entitlementExpiresAt: string | null = null;
    if (productId === adFreeProduct) {
      const expiresDate = typeof tx.expiresDate === 'number' ? tx.expiresDate : 0;
      if (!expiresDate || expiresDate <= Date.now()) throw new Error('SUBSCRIPTION_NOT_ACTIVE');
      entitlementExpiresAt = new Date(expiresDate).toISOString();
    }

    const { data, error } = await service.rpc('apply_verified_store_purchase', {
      p_user_id: authData.user.id,
      p_provider: 'app_store',
      p_transaction_id: transactionId,
      p_product_id: productId,
      p_points: pointProducts[productId] ?? 0,
      p_entitlement_type: themeProducts.has(productId)
        ? 'app_theme'
        : productId === adFreeProduct ? 'ad_free' : null,
      p_entitlement_expires_at: entitlementExpiresAt,
      p_environment: verified.environment,
      p_raw_payload: {
        transaction: tx,
        apple: verified.raw,
        verifiedAt: new Date().toISOString(),
      },
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return Response.json({
      pointBalance: Number(row?.point_balance ?? 0),
      credited: Boolean(row?.credited),
    }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'STORE_VERIFICATION_FAILED' },
      { headers: cors },
    );
  }
});
