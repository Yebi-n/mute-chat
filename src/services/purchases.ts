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
