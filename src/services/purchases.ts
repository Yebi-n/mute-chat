export { STORE_PRODUCTS } from './storeProducts';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export async function configurePurchases(_appUserId: string) {}

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

export async function listStoreEntitlements() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
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
