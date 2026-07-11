export { STORE_PRODUCTS } from './storeProducts';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export async function configurePurchases(_appUserId: string) {}

export function resetPurchaseConfiguration() {}

export async function purchaseProduct(productId: string) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  const { data, error } = await supabase.rpc('purchase_point_product', {
    p_product_id: productId,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function purchaseStoreProduct(_productId: string): Promise<{
  pointBalance: number;
  credited: boolean;
  transactionId: string;
}> {
  throw new Error('STORE_PURCHASE_PLATFORM_NOT_AVAILABLE');
}

export async function restoreStorePurchases(): Promise<{
  restored: number;
  pointBalance: number;
}> {
  throw new Error('STORE_PURCHASE_PLATFORM_NOT_AVAILABLE');
}

export async function listStoreEntitlements(expectedUserId?: string) {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) return [];
  if (expectedUserId && userId !== expectedUserId) return [];

  const { data, error } = await supabase
    .from('user_entitlements')
    .select('product_id,entitlement_type,expires_at')
    .eq('user_id', userId)
    .in('entitlement_type', ['app_theme', 'ad_free']);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    productId: row.product_id as string,
    type: row.entitlement_type as string,
    expiresAt: row.expires_at as string | null,
  }));
}
