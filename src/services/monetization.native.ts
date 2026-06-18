import { Platform } from 'react-native';
import {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
export { claimPointReward, getMyWallet } from './wallet';

export async function showRewardedAd(): Promise<{ completed: boolean; rewardKey: string }> {
  const unitId = Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS_ID || TestIds.REWARDED
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID_ID || TestIds.REWARDED;
  const rewarded = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
  return new Promise((resolve, reject) => {
    let earned = false;
    const unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => rewarded.show());
    const unsubscribeEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; });
    const unsubscribeClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      unsubscribeLoaded(); unsubscribeEarned(); unsubscribeClosed(); unsubscribeError();
      resolve({ completed: earned, rewardKey: `admob-${Date.now()}` });
    });
    const unsubscribeError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
      unsubscribeLoaded(); unsubscribeEarned(); unsubscribeClosed(); unsubscribeError();
      reject(error);
    });
    rewarded.load();
  });
}
