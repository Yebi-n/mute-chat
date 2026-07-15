import { Platform } from 'react-native';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  syncIOS,
  type ProductQueryType,
  type Purchase,
} from 'expo-iap';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
export { STORE_PRODUCTS } from './storeProducts';

let connected = false;
let configuredUserId: string | null = null;

const consumableProductIds = new Set([
  'mute_points_5000',
  'mute_points_11000',
  'mute_points_28000',
  'mute_points_60000',
  'mute_points_200000',
  'mute_points_390000',
]);

const storeProductIds = new Set([
  ...consumableProductIds,
  'mute_theme_white',
  'mute_theme_mint',
  'mute_theme_ocean',
  'mute_theme_lavender',
  'mute_theme_sunset',
  'mute_theme_mono',
  'mute_theme_dark',
  'mute_ad_free_monthly',
]);

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('서버 설정을 확인해주세요.');
  }
  return supabase;
}

async function ensureConnection() {
  if (!connected) {
    await initConnection();
    if (Platform.OS === 'ios') {
      await syncIOS().catch(() => undefined);
    }
    connected = true;
  }
}

export async function configurePurchases(appUserId: string) {
  configuredUserId = appUserId;
}

export function resetPurchaseConfiguration() {
  configuredUserId = null;
}

export async function purchaseProduct(productId: string) {
  const { data, error } = await requireSupabase().rpc('purchase_point_product', {
    p_product_id: productId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function normalizePurchaseResult(event: Purchase | Purchase[] | null | unknown): Purchase | null {
  if (!event) return null;
  return Array.isArray(event) ? (event[0] as Purchase | undefined) ?? null : event as Purchase;
}

function getStoreProductId(product: unknown) {
  if (!product || typeof product !== 'object') return null;
  const record = product as Record<string, unknown>;
  return typeof record.id === 'string'
    ? record.id
    : typeof record.productId === 'string'
      ? record.productId
      : null;
}

async function fetchStoreProducts(productId: string, productType: ProductQueryType) {
  const allKnownProductIds = Array.from(storeProductIds);
  const primary = await fetchProducts({ skus: [productId], type: productType });
  if (primary?.some((product) => getStoreProductId(product) === productId)) {
    return primary;
  }
  if (Platform.OS === 'ios') {
    const fallback = await fetchProducts({ skus: [productId], type: 'all' as ProductQueryType });
    if (fallback?.some((product) => getStoreProductId(product) === productId)) {
      return fallback;
    }
    const broadFallback = await fetchProducts({ skus: allKnownProductIds, type: 'all' as ProductQueryType });
    return [...(primary ?? []), ...(fallback ?? []), ...(broadFallback ?? [])];
  }
  return primary ?? [];
}

async function waitForPurchase(productId: string, startPurchase: () => Promise<unknown>) {
  return await new Promise<Purchase>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      updated.remove();
      failed.remove();
      clearTimeout(timer);
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    const handlePurchase = (event: Purchase | Purchase[] | null | unknown) => {
      const purchase = normalizePurchaseResult(event);
      if (!purchase || purchase.productId !== productId) return;
      if (!purchaseBelongsToConfiguredUser(purchase, { allowMissingToken: true })) return;
      settle(() => resolve(purchase));
    };

    const updated = purchaseUpdatedListener((event) => {
      handlePurchase(event);
    });
    const failed = purchaseErrorListener((error) => {
      settle(() => reject(new Error(error.message || error.code || 'PURCHASE_FAILED')));
    });
    const timer = setTimeout(() => {
      settle(() => reject(new Error('PURCHASE_TIMEOUT')));
    }, 120000);

    startPurchase()
      .then((result) => {
        handlePurchase(result);
      })
      .catch((error) => {
        settle(() => reject(error));
      });
  });
}

function decodeBase64UrlJson(value: string): Record<string, unknown> | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const atobFn = (globalThis as { atob?: (input: string) => string }).atob;
    if (typeof atobFn !== 'function') return null;
    const decoded = atobFn(padded);
    const json = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSignedTransactionInfo(purchase: Purchase) {
  const record = purchase as unknown as Record<string, unknown>;
  const candidates = [
    record.purchaseToken,
    record.signedTransactionInfo,
    record.jwsRepresentationIOS,
    record.transactionReceipt,
  ];
  return candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.split('.').length >= 3,
  ) ?? null;
}

function getVerifiedTransactionId(purchase: Purchase) {
  const signedTransactionInfo = getSignedTransactionInfo(purchase);
  if (signedTransactionInfo) {
    const payload = decodeBase64UrlJson(signedTransactionInfo.split('.')[1] ?? '');
    const transactionId = payload?.transactionId;
    if (typeof transactionId === 'string' || typeof transactionId === 'number') {
      return String(transactionId);
    }
  }
  return purchase.transactionId ?? purchase.id ?? null;
}

function getVerifiedAppAccountToken(purchase: Purchase) {
  const record = purchase as unknown as Record<string, unknown>;
  const directAppAccountToken = record.appAccountToken;
  if (typeof directAppAccountToken === 'string' && directAppAccountToken.trim()) {
    return directAppAccountToken.toLowerCase();
  }
  const signedTransactionInfo = getSignedTransactionInfo(purchase);
  if (!signedTransactionInfo) return null;
  const payload = decodeBase64UrlJson(signedTransactionInfo.split('.')[1] ?? '');
  const appAccountToken = payload?.appAccountToken;
  return typeof appAccountToken === 'string' ? appAccountToken.toLowerCase() : null;
}

function purchaseBelongsToConfiguredUser(
  purchase: Purchase,
  options: { allowMissingToken?: boolean } = {},
) {
  if (!configuredUserId) return true;
  const appAccountToken = getVerifiedAppAccountToken(purchase);
  // If StoreKit publishes a completed transaction for another app account
  // while the user has switched accounts, do not verify it against the
  // current Supabase user. This prevents stale purchases from becoming
  // TRANSACTION_OWNED_BY_ANOTHER_ACCOUNT on the server.
  if (!appAccountToken) return Boolean(options.allowMissingToken);
  return appAccountToken === configuredUserId.toLowerCase();
}

async function verifyStorePurchase(productId: string, purchase: Purchase) {
  const transactionId = getVerifiedTransactionId(purchase);
  if (!transactionId) {
    throw new Error('구매 거래 ID를 확인할 수 없습니다.');
  }

  const signedTransactionInfo = getSignedTransactionInfo(purchase);

  const { data, error } = await requireSupabase().functions.invoke(
    'verify-store-purchase',
    {
      method: 'POST',
      body: {
        platform: Platform.OS,
        productId,
        transactionId,
        signedTransactionInfo,
        appAccountToken: configuredUserId,
      },
    },
  );
  if (error) throw new Error(`구매 검증에 실패했습니다: ${error.message}`);
  if (data?.error) throw new Error(`구매 검증에 실패했습니다: ${data.error}`);

  await finishTransaction({
    purchase,
    isConsumable: consumableProductIds.has(productId),
  });

  return {
    pointBalance: Number(data?.pointBalance ?? 0),
    credited: Boolean(data?.credited),
    transactionId,
  };
}

export async function purchaseStoreProduct(productId: string) {
  await ensureConnection();
  const productType: ProductQueryType = productId === 'mute_ad_free_monthly' ? 'subs' : 'in-app';
  const products = await fetchStoreProducts(productId, productType);
  if (!products?.some((product) => getStoreProductId(product) === productId)) {
    const fetched = products
      .map((product) => getStoreProductId(product))
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `STORE_PRODUCT_NOT_FOUND:${productId}${fetched ? ` fetched=${fetched}` : ''}`,
    );
  }

  const purchase = await waitForPurchase(productId, () =>
    requestPurchase({
      type: productType === 'subs' ? 'subs' : 'in-app',
      request: {
        apple: {
          sku: productId,
          appAccountToken: configuredUserId ?? undefined,
          andDangerouslyFinishTransactionAutomatically: false,
        },
        google: { skus: [productId] },
      },
    }),
  );

  return verifyStorePurchase(productId, purchase);
}

export async function restoreStorePurchases() {
  await ensureConnection();
  await restorePurchases();
  const purchases = await getAvailablePurchases({
    alsoPublishToEventListenerIOS: false,
    onlyIncludeActiveItemsIOS: true,
  });
  let restored = 0;
  let pointBalance = 0;

  for (const purchase of purchases ?? []) {
    if (!storeProductIds.has(purchase.productId)) continue;
    if (consumableProductIds.has(purchase.productId)) continue;
    if (!purchaseBelongsToConfiguredUser(purchase)) continue;
    const result = await verifyStorePurchase(purchase.productId, purchase);
    pointBalance = result.pointBalance;
    if (result.credited) restored += 1;
  }

  return { restored, pointBalance };
}

export async function listStoreEntitlements() {
  const { data, error } = await requireSupabase()
    .from('user_entitlements')
    .select('product_id,entitlement_type,expires_at')
    .in('entitlement_type', ['app_theme', 'ad_free']);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    productId: row.product_id as string,
    type: row.entitlement_type as string,
    expiresAt: row.expires_at as string | null,
  }));
}
