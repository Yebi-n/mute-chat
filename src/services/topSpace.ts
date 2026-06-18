import { isSupabaseConfigured, supabase } from '../lib/supabase';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  return supabase;
}

export async function listTopSpaces() {
  const { data, error } = await requireClient()
    .from('room_top_spaces')
    .select('room_id,expires_at,total_duration_seconds,boost_count')
    .gt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data ?? [];
}

export async function boostTopSpace(roomId: string, points: number) {
  const { data, error } = await requireClient().rpc('boost_room_top_space', {
    p_room_id: roomId,
    p_points: points,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    expiresAt: row.expires_at as string,
    totalDurationSeconds: Number(row.total_duration_seconds),
    pointBalance: Number(row.point_balance),
  };
}
