import { Platform } from 'react-native';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AdEventType,
  AdsConsent,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  default as mobileAds,
} from 'react-native-google-mobile-ads';
export {
  claimPointReward,
  getMyWallet,
  listPointLedger,
  transferRoomPoints,
} from './wallet';

let adsInitializationPromise: Promise<boolean> | null = null;
let trackingPermissionPromise: Promise<void> | null = null;
const IOS_REWARDED_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID
  || 'ca-app-pub-4013454985021474/1566965165';
const REVIEW_AD_TEST_EMAILS = new Set([
  'test-alpha@user.mute.app',
  'test-bravo@user.mute.app',
  'test-charlie@user.mute.app',
]);

export async function shouldUseReviewTestAds(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error) return false;
  const email = data.user?.email?.trim().toLowerCase();
  return Boolean(email && REVIEW_AD_TEST_EMAILS.has(email));
}

export async function ensureTrackingPermissionRequested(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  if (trackingPermissionPromise) return trackingPermissionPromise;
  trackingPermissionPromise = (async () => {
    try {
      const current = await getTrackingPermissionsAsync();
      if (current.status === 'undetermined' && current.canAskAgain) {
        await requestTrackingPermissionsAsync();
      }
    } catch {
      // ATT failures should not block contextual ads. AdMob is still requested
      // with non-personalized ad settings below.
    }
  })();
  return trackingPermissionPromise;
}

export function initializeAds(): Promise<boolean> {
  if (adsInitializationPromise) return adsInitializationPromise;
  adsInitializationPromise = (async () => {
    await ensureTrackingPermissionRequested();
    try {
      await AdsConsent.gatherConsent();
    } catch {
      // Previous-session consent can still permit ads when the form request
      // temporarily fails. getConsentInfo is the final SDK gate below.
    }
    const consent = await AdsConsent.getConsentInfo();
    if (!consent.canRequestAds) {
      adsInitializationPromise = null;
      return false;
    }
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    return true;
  })().catch((error) => {
    adsInitializationPromise = null;
    throw error;
  });
  return adsInitializationPromise;
}

export async function showRewardedAd(
  rewardType: 'attendance' | 'rewarded_ad',
): Promise<{ completed: boolean; rewardKey: string }> {
  const initialized = await initializeAds();
  if (!initialized) throw new Error('ADS_CONSENT_REQUIRED');
  const configuredUnitId = Platform.OS === 'ios'
    ? IOS_REWARDED_UNIT_ID
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID;
  const useTestAds =
    __DEV__
    || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true'
    || await shouldUseReviewTestAds();
  const productionUnitId = useTestAds ? undefined : configuredUnitId;
  const unitId = productionUnitId || TestIds.REWARDED;
  let rewardKey = `admob-test-${Date.now()}`;
  let serverSideVerificationOptions:
    | { userId: string; customData: string }
    | undefined;
  if (productionUnitId) {
    if (!isSupabaseConfigured || !supabase) throw new Error('SUPABASE_REQUIRED');
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error('AUTH_REQUIRED');
    const { data, error } = await supabase.rpc('create_rewarded_ad_session', {
      p_reward_type: rewardType,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.session_id) throw new Error('AD_SESSION_CREATE_FAILED');
    rewardKey = `admob-ssv:${row.session_id}`;
    serverSideVerificationOptions = {
      userId: authData.user.id,
      customData: String(row.custom_data ?? row.session_id),
    };
  }
  const rewarded = RewardedAd.createForAdRequest(unitId, {
    requestNonPersonalizedAdsOnly: true,
    serverSideVerificationOptions,
  });
  return new Promise((resolve, reject) => {
    let earned = false;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      callback();
    };
    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => rewarded.show().catch((error) => finish(() => reject(error))),
    );
    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      finish(() => resolve({ completed: earned, rewardKey }));
    });
    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      finish(() => reject(error));
    });
    const timeout = setTimeout(
      () => finish(() => reject(new Error('REWARDED_AD_LOAD_TIMEOUT'))),
      15000,
    );
    rewarded.load();
  });
}
