import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type Wallet = {
  pointBalance: number;
  attendanceAvailableAt: string;
  rewardedAdAvailable: boolean;
};

function requireClient() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  return supabase;
}

export async function getMyWallet(): Promise<Wallet> {
  const { data, error } = await requireClient().rpc('get_my_wallet');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    pointBalance: Number(row?.point_balance ?? 0),
    attendanceAvailableAt: row?.attendance_available_at ?? new Date().toISOString(),
    rewardedAdAvailable: Boolean(row?.rewarded_ad_available ?? true),
  };
}

export async function claimPointReward(type: 'attendance' | 'rewarded_ad', rewardKey: string) {
  const { data, error } = await requireClient().rpc('claim_point_reward', {
    p_reward_type: type,
    p_reward_key: rewardKey,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    pointBalance: Number(row?.point_balance ?? 0),
    awardedPoints: Number(row?.awarded_points ?? 0),
    nextAvailableAt: row?.next_available_at as string,
  };
}
