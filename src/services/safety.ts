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

function functionErrorMessage(value: unknown) {
  if (typeof value === 'string') return value;
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parts = ['message', 'error_description', 'error', 'code', 'details', 'hint']
      .map((key) => record[key])
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    if (parts.length > 0) return parts.join(' / ');
    try {
      const json = JSON.stringify(record);
      if (json && json !== '{}') return json;
    } catch {
      // Fall through to the stable fallback below.
    }
    return '알 수 없는 오류가 발생했습니다.';
  }
  return value == null ? '알 수 없는 오류가 발생했습니다.' : String(value);
}

async function functionInvokeErrorMessage(error: unknown) {
  const context =
    error && typeof error === 'object'
      ? (error as { context?: unknown }).context
      : undefined;
  if (context && typeof context === 'object') {
    const response = context as {
      clone?: () => {
        json?: () => Promise<unknown>;
        text?: () => Promise<string>;
      };
      json?: () => Promise<unknown>;
      text?: () => Promise<string>;
    };
    const clone = typeof response.clone === 'function' ? response.clone.bind(response) : null;
    try {
      const body = clone ? await clone().json?.() : await response.json?.();
      if (body != null) {
        const record = body as Record<string, unknown>;
        const message = functionErrorMessage(record.error ?? record.message ?? body);
        if (message && message !== '{}') return message;
      }
    } catch {
      // The response may not be JSON. Try text below.
    }
    try {
      const text = clone ? await clone().text?.() : await response.text?.();
      if (typeof text === 'string' && text.trim().length > 0) return text.trim();
    } catch {
      // Fall through to the generic error serializer.
    }
  }
  return functionErrorMessage(error);
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

export async function listReportedRoomIds() {
  const { data, error } = await requireClient().rpc('list_reported_room_ids');
  if (error) throw error;
  return ((data ?? []) as Array<{ room_id: string }>).map((row) => row.room_id);
}

export async function acceptSignupCompliance() {
  const { error } = await requireClient().rpc('complete_signup_compliance', {
    p_privacy_version: '1.0',
  });
  if (error) throw error;
}

export async function requestAccountDeletion() {
  const client = requireClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) {
    throw new Error('AUTH_SESSION_MISSING');
  }

  const { data, error } = await client.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw new Error(await functionInvokeErrorMessage(error));
  if (data?.error) throw new Error(functionErrorMessage(data.error));
  return data?.blockedUntil as string;
}

export async function cancelAccountDeletion() {
  const { error } = await requireClient().rpc('cancel_account_deletion');
  if (error) throw error;
}
