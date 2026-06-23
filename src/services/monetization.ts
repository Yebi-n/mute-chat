export { claimPointReward, getMyWallet, listPointLedger, transferRoomPoints } from './wallet';
export type { PointLedgerItem } from './wallet';

export async function showRewardedAd(): Promise<{ completed: boolean; rewardKey: string }> {
  throw new Error('REWARDED_AD_PLATFORM_NOT_AVAILABLE');
}
