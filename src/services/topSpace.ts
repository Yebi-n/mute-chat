import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { dispatchPendingPushes } from './notifications';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  return supabase;
}

export async function listTopSpaces() {
  const { data, error } = await requireClient()
    .from('room_top_spaces')
    .select('room_id,expires_at,total_duration_seconds,boost_count');
  if (error) throw error;
  return data ?? [];
}

export async function boostTopSpace(roomId: string, points: number, requestId: string) {
  const { data, error } = await requireClient().rpc('boost_room_top_space', {
    p_room_id: roomId,
    p_points: points,
    p_request_id: requestId,
  });
  if (error) throw error;
  dispatchPendingPushes().catch(() => undefined);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    expiresAt: row.expires_at as string,
    totalDurationSeconds: Number(row.total_duration_seconds),
    pointBalance: Number(row.point_balance),
    boostCount: Number(row.boost_count),
  };
}
