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
    connected = true;
  }
}

export async function configurePurchases(appUserId: string) {
  configuredUserId = appUserId;
  await ensureConnection();
}

export async function purchaseProduct(productId: string) {
  const { data, error } = await requireSupabase().rpc('purchase_point_product', {
    p_product_id: productId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

function normalizePurchaseResult(event: Purchase | Purchase[] | null): Purchase | null {
  if (!event) return null;
  return Array.isArray(event) ? event[0] ?? null : event;
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
    const updated = purchaseUpdatedListener((event) => {
      const purchase = normalizePurchaseResult(event);
      if (!purchase || purchase.productId !== productId) return;
      settle(() => resolve(purchase));
    });
    const failed = purchaseErrorListener((error) => {
      settle(() => reject(new Error(error.message || error.code || 'PURCHASE_FAILED')));
    });
    const timer = setTimeout(() => {
      settle(() => reject(new Error('PURCHASE_TIMEOUT')));
    }, 120000);

    startPurchase().catch((error) => {
      settle(() => reject(error));
    });
  });
}

async function verifyStorePurchase(productId: string, purchase: Purchase) {
  const transactionId = purchase.transactionId ?? purchase.id;
  if (!transactionId) {
    throw new Error('구매 거래 ID를 확인할 수 없습니다.');
  }

  const { data, error } = await requireSupabase().functions.invoke(
    'verify-store-purchase',
    {
      method: 'POST',
      body: {
        platform: Platform.OS,
        productId,
        transactionId,
        signedTransactionInfo: purchase.purchaseToken ?? null,
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
  const products = await fetchProducts({ skus: [productId], type: productType });
  if (!products?.some((product) => product.id === productId)) {
    throw new Error(`STORE_PRODUCT_NOT_FOUND:${productId}`);
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
