export { claimPointReward, getMyWallet } from './wallet';

export async function showRewardedAd() {
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { completed: true, rewardKey: `web-test-${Date.now()}` };
}
