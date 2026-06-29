export { claimPointReward, getMyWallet, listPointLedger, transferRoomPoints } from './wallet';
export type { PointLedgerItem } from './wallet';

export async function initializeAds(): Promise<boolean> {
  return false;
}

export async function showRewardedAd(
  _rewardType: 'attendance' | 'rewarded_ad',
): Promise<{ completed: boolean; rewardKey: string }> {
  throw new Error('REWARDED_AD_PLATFORM_NOT_AVAILABLE');
}
