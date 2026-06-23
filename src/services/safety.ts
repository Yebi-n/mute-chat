import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type ReportTarget = 'room' | 'user' | 'message' | 'story' | 'comment';
export type ReportReason =
  | 'sexual_content'
  | 'minor_safety'
  | 'harassment'
  | 'hate'
  | 'violence'
  | 'self_harm'
  | 'illegal_activity'
  | 'privacy'
  | 'spam'
  | 'impersonation'
  | 'other';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export async function blockUser(userId: string) {
  const { error } = await requireClient().rpc('block_user', {
    p_blocked_user_id: userId,
  });
  if (error) throw error;
}

export async function unblockUser(userId: string) {
  const { error } = await requireClient().rpc('unblock_user', {
    p_blocked_user_id: userId,
  });
  if (error) throw error;
}

export async function submitReport(input: {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  detail?: string;
}) {
  const { data, error } = await requireClient().rpc('submit_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_detail: input.detail ?? '',
  });
  if (error) throw error;
  const reportId = data as string;
  requireClient().functions.invoke('send-report-email', {
    method: 'POST',
    body: { reportId },
  }).catch(() => undefined);
  return reportId;
}

export async function requestAccountDeletion() {
  const { data, error } = await requireClient().functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.blockedUntil as string;
}

export async function cancelAccountDeletion() {
  const { error } = await requireClient().rpc('cancel_account_deletion');
  if (error) throw error;
}
