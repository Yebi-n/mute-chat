import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type StoreTransactionItem = {
  id: string;
  provider: string;
  transactionId: string;
  productId: string;
  pointsAwarded: number;
  entitlementType: string | null;
  entitlementExpiresAt: string | null;
  environment: string | null;
  createdAt: string;
};

export async function listStoreTransactions(limit = 80): Promise<StoreTransactionItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('서버 설정을 확인해주세요.');
  }
  const { data, error } = await supabase
    .from('store_transactions')
    .select('id,provider,transaction_id,product_id,points_awarded,entitlement_type,entitlement_expires_at,environment,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    provider: string | null;
    transaction_id: string | null;
    product_id: string | null;
    points_awarded: number | string | null;
    entitlement_type: string | null;
    entitlement_expires_at: string | null;
    environment: string | null;
    created_at: string | null;
  }>).map((row) => ({
    id: row.id,
    provider: row.provider ?? '',
    transactionId: row.transaction_id ?? '',
    productId: row.product_id ?? '',
    pointsAwarded: Number(row.points_awarded ?? 0),
    entitlementType: row.entitlement_type,
    entitlementExpiresAt: row.entitlement_expires_at,
    environment: row.environment,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}
