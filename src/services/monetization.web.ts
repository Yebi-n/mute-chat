export {
  claimPointReward,
  getMyWallet,
  listPointLedger,
  transferRoomPoints,
} from './wallet';
export type { PointLedgerItem } from './wallet';

export async function initializeAds(): Promise<boolean> {
  return false;
}

export async function showRewardedAd(_rewardType: 'attendance' | 'rewarded_ad') {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { completed: true, rewardKey: `web-test-${Date.now()}` };
}
