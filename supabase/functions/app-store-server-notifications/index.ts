import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function decodeJwsPayload<T>(signedPayload: unknown): T | null {
  if (typeof signedPayload !== 'string') return null;
  const parts = signedPayload.split('.');
  if (parts.length < 2) return null;
  try {
    return decodeBase64UrlJson<T>(parts[1]);
  } catch {
    return null;
  }
}

function toIsoFromMs(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return new Date(value).toISOString();
}

function toUuidOrNull(value: unknown) {
  if (typeof value !== 'string') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const parts = [value.code, value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (parts.length > 0) return parts.join(': ');
  }
  return 'UNKNOWN_ERROR';
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
        transaction: decodeJwsPayload<Record<string, unknown>>(signed),
        raw: payload,
      };
    }
    if (![400, 401, 403, 404].includes(response.status)) break;
  }
  throw new Error('APPLE_TRANSACTION_NOT_FOUND');
}

async function findUserId(service: ReturnType<typeof createClient>, tx: Record<string, unknown>) {
  const appAccountToken = toUuidOrNull(tx.appAccountToken);
  if (appAccountToken) return appAccountToken;

  const transactionId = tx.transactionId == null ? null : String(tx.transactionId);
  const originalTransactionId = tx.originalTransactionId == null ? null : String(tx.originalTransactionId);
  const ids = [transactionId, originalTransactionId].filter(Boolean);
  if (ids.length === 0) return null;

  const { data } = await service
    .from('store_transactions')
    .select('user_id')
    .eq('provider', 'app_store')
    .in('transaction_id', ids)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

function shouldExpire(notificationType: string, subtype: string | null) {
  return [
    'EXPIRED',
    'REFUND',
    'REVOKE',
    'REFUND_DECLINED',
  ].includes(notificationType) || subtype === 'VOLUNTARY';
}

function shouldActivate(notificationType: string, expiresAt: string | null) {
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) return false;
  return [
    'SUBSCRIBED',
    'DID_RENEW',
    'DID_RECOVER',
    'DID_CHANGE_RENEWAL_STATUS',
    'DID_CHANGE_RENEWAL_PREF',
    'PRICE_INCREASE',
    'GRACE_PERIOD_EXPIRED',
    'OFFER_REDEEMED',
  ].includes(notificationType);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method === 'GET') {
    return Response.json({
      ok: true,
      service: 'app-store-server-notifications',
      methods: ['POST'],
    }, { headers: cors });
  }
  if (request.method !== 'POST') {
    return Response.json({ error: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: cors });
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let signedPayload: unknown = null;
  let notification: Record<string, unknown> | null = null;
  let tx: Record<string, unknown> | null = null;
  let status = 'received';
  let errorMessage: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    signedPayload = body?.signedPayload;
    notification = decodeJwsPayload<Record<string, unknown>>(signedPayload);
    if (!notification) throw new Error('INVALID_SIGNED_PAYLOAD');

    const data = notification.data as Record<string, unknown> | undefined;
    tx = decodeJwsPayload<Record<string, unknown>>(data?.signedTransactionInfo);
    if (!tx) throw new Error('MISSING_TRANSACTION_INFO');

    const transactionId = tx.transactionId == null ? null : String(tx.transactionId);
    if (transactionId) {
      const verified = await fetchAppleTransaction(transactionId);
      tx = verified.transaction ?? tx;
      if (verified.environment) tx.environment = verified.environment;
    }

    const bundleId = Deno.env.get('APP_STORE_BUNDLE_ID') ?? 'app.mute.chat';
    if (tx.bundleId !== bundleId) throw new Error('BUNDLE_ID_MISMATCH');
  } catch (error) {
    status = 'verification_failed';
    errorMessage = getErrorMessage(error);
  }

  const notificationType = String(notification?.notificationType ?? 'UNKNOWN');
  const subtype = notification?.subtype == null ? null : String(notification.subtype);
  const notificationUuid = notification?.notificationUUID == null ? null : String(notification.notificationUUID);
  const environment = String(tx?.environment ?? (notification?.data as Record<string, unknown> | undefined)?.environment ?? '');
  const productId = tx?.productId == null ? null : String(tx.productId);
  const transactionId = tx?.transactionId == null ? null : String(tx.transactionId);
  const originalTransactionId = tx?.originalTransactionId == null ? null : String(tx.originalTransactionId);
  const expiresAt = toIsoFromMs(tx?.expiresDate);
  const appAccountToken = toUuidOrNull(tx?.appAccountToken);
  const matchedUserId = tx ? await findUserId(service, tx) : null;

  if (status === 'received' && productId === adFreeProduct && matchedUserId) {
    if (shouldExpire(notificationType, subtype)) {
      const { error } = await service
        .from('user_entitlements')
        .update({ expires_at: new Date().toISOString() })
        .eq('user_id', matchedUserId)
        .eq('product_id', adFreeProduct);
      if (error) {
        status = 'processing_failed';
        errorMessage = getErrorMessage(error);
      } else {
        status = 'expired';
      }
    } else if (shouldActivate(notificationType, expiresAt)) {
      const { error } = await service.rpc('apply_verified_store_purchase', {
        p_user_id: matchedUserId,
        p_provider: 'app_store',
        p_transaction_id: transactionId ?? originalTransactionId ?? notificationUuid,
        p_product_id: adFreeProduct,
        p_points: 0,
        p_entitlement_type: 'ad_free',
        p_entitlement_expires_at: expiresAt,
        p_environment: environment || null,
        p_raw_payload: { notification, transaction: tx, processedBy: 'app-store-server-notifications' },
      });
      if (error) {
        status = 'processing_failed';
        errorMessage = getErrorMessage(error);
      } else {
        status = 'activated';
      }
    }
  } else if (status === 'received' && productId !== adFreeProduct) {
    status = 'ignored_product';
  } else if (status === 'received' && !matchedUserId) {
    status = 'unmatched_user';
  }

  const { error: logError } = await service
    .from('app_store_server_notifications')
    .upsert({
      notification_uuid: notificationUuid,
      notification_type: notificationType,
      subtype,
      environment: environment || null,
      bundle_id: tx?.bundleId == null ? null : String(tx.bundleId),
      product_id: productId,
      transaction_id: transactionId,
      original_transaction_id: originalTransactionId,
      app_account_token: appAccountToken,
      matched_user_id: matchedUserId,
      status,
      expires_at: expiresAt,
      signed_payload: typeof signedPayload === 'string' ? signedPayload : null,
      raw_payload: { notification, transaction: tx },
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    }, { onConflict: 'notification_uuid' });

  if (logError) {
    console.error('app-store-server-notifications log failed', getErrorMessage(logError));
  }

  return Response.json({ ok: true, status }, { headers: cors });
});
