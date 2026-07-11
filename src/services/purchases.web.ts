export { STORE_PRODUCTS } from './storeProducts';

export async function configurePurchases(_appUserId: string) {}

export function resetPurchaseConfiguration() {}

export async function purchaseProduct(_productId: string): Promise<never> {
  throw new Error('NATIVE_PURCHASE_REQUIRED');
}

export async function purchaseStoreProduct(_productId: string): Promise<{
  pointBalance: number;
  credited: boolean;
  transactionId: string;
}> {
  throw new Error('NATIVE_PURCHASE_REQUIRED');
}

export async function restoreStorePurchases(): Promise<{
  restored: number;
  pointBalance: number;
}> {
  throw new Error('NATIVE_PURCHASE_REQUIRED');
}

export async function listStoreEntitlements(_expectedUserId?: string) {
  return [];
}
