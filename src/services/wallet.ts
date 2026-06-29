import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dispatchPendingPushes } from './notifications';

export type Wallet = {
  pointBalance: number;
  attendanceAvailableAt: string;
  rewardedAdAvailable: boolean;
};

export type PointLedgerItem = {
  id: string;
  amount: number;
  reason: string;
  referenceId: string | null;
  createdAt: string;
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

export async function listPointLedger(limit = 80): Promise<PointLedgerItem[]> {
  const { data, error } = await requireClient().rpc('list_my_point_ledger', {
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{
    id: string;
    amount: number | string | null;
    reason: string | null;
    reference_id: string | null;
    created_at: string | null;
  }>).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount ?? 0),
    reason: (row.reason ?? 'admin_point') as string,
    referenceId: row.reference_id as string | null,
    createdAt: (row.created_at ?? new Date().toISOString()) as string,
  }));
}

export async function transferRoomPoints(input: {
  roomId: string;
  recipientUserId: string;
  amount: number;
  requestId: string;
}) {
  const { data, error } = await requireClient().rpc('transfer_room_points', {
    p_room_id: input.roomId,
    p_recipient_user_id: input.recipientUserId,
    p_amount: input.amount,
    p_request_id: input.requestId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.message_id || !Number.isFinite(Number(row?.point_balance))) {
    throw new Error('POINT_TRANSFER_INVALID_RESPONSE');
  }
  dispatchPendingPushes().catch(() => undefined);
  return {
    pointBalance: Number(row?.point_balance ?? 0),
    messageId: row?.message_id as string,
  };
}
