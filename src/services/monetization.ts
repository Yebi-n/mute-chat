export { claimPointReward, getMyWallet } from './wallet';

export async function showRewardedAd(): Promise<{ completed: boolean; rewardKey: string }> {
  throw new Error('REWARDED_AD_PLATFORM_NOT_AVAILABLE');
}
