import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
export { STORE_PRODUCTS } from './storeProducts';

let configured = false;

export async function configurePurchases(appUserId: string) {
  if (configured) return;
  const apiKey = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
  if (!apiKey) throw new Error('REVENUECAT_API_KEY_NOT_CONFIGURED');
  Purchases.configure({ apiKey, appUserID: appUserId });
  configured = true;
}

export async function purchaseProduct(productId: string) {
  const products = await Purchases.getProducts([productId]);
  const product = products[0];
  if (!product) throw new Error('STORE_PRODUCT_NOT_FOUND');
  return Purchases.purchaseStoreProduct(product);
}
