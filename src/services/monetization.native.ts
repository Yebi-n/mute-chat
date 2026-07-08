import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
export {
  claimPointReward,
  getMyWallet,
  listPointLedger,
  transferRoomPoints,
} from './wallet';

let adsInitializationPromise: Promise<boolean> | null = null;
const IOS_REWARDED_UNIT_ID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID
  || 'ca-app-pub-4013454985021474/1566965165';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

function loadGoogleMobileAds(): GoogleMobileAdsModule {
  // Keep AdMob out of the startup module graph. Recent TestFlight builds crash
  // in the native bridge shortly after launch; lazy-loading isolates the SDK to
  // the explicit rewarded-ad path.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
}

export function initializeAds(): Promise<boolean> {
  if (adsInitializationPromise) return adsInitializationPromise;
  adsInitializationPromise = (async () => {
    const { MaxAdContentRating, default: mobileAds } = loadGoogleMobileAds();
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    return true;
  })().catch((error) => {
    console.warn('[ads] initialization failed', error);
    return false;
  });
  return adsInitializationPromise;
}

export async function showRewardedAd(
  rewardType: 'attendance' | 'rewarded_ad',
): Promise<{ completed: boolean; rewardKey: string }> {
  const initialized = await initializeAds();
  if (!initialized) throw new Error('ADS_CONSENT_REQUIRED');
  const {
    AdEventType,
    RewardedAd,
    RewardedAdEventType,
    TestIds,
  } = loadGoogleMobileAds();
  const configuredUnitId = Platform.OS === 'ios'
    ? IOS_REWARDED_UNIT_ID
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID;
  const useTestAds = __DEV__ || process.env.EXPO_PUBLIC_ADMOB_USE_TEST_ADS === 'true';
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
