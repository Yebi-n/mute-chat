export { STORE_PRODUCTS } from './storeProducts';

export async function configurePurchases(_appUserId: string) {}

export async function purchaseProduct(_productId: string): Promise<never> {
  throw new Error('NATIVE_PURCHASE_REQUIRED');
}
