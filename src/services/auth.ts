import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

function authError(error: unknown) {
  if (!error) return new Error('알 수 없는 인증 오류가 발생했습니다.');
  if (error instanceof Error && error.message && error.message !== '[object Object]') return error;
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const nested = record.error as Record<string, unknown> | undefined;
    const message = record.message ?? record.error_description ?? record.code ?? nested?.message ?? nested?.code;
    if (typeof message === 'string' && message && message !== '[object Object]') return new Error(message);
  }
  if (typeof error === 'string' && error && error !== '[object Object]') return new Error(error);
  return new Error('인증 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

export function normalizeKoreanPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

export async function signInWithPhonePassword(phoneNumber: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    phone: normalizeKoreanPhoneNumber(phoneNumber),
    password,
  });
  if (error) throw authError(error);
  return data.session;
}

export function adminIdToEmail(adminId: string) {
  const normalized = adminId.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(normalized)) {
    throw new Error('Invalid administrator ID.');
  }
  return `${normalized}@admin.mute.app`;
}

export function testIdToEmail(testId: string) {
  const normalized = testId.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(normalized)) {
    throw new Error('Invalid test user ID.');
  }
  return `${normalized}@user.mute.app`;
}

export async function signInWithAdminId(adminId: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: adminIdToEmail(adminId),
    password,
  });
  if (error) throw authError(error);
  if (data.user.app_metadata?.admin_role !== 'super_admin') {
    await requireClient().auth.signOut();
    throw new Error('Administrator permission is required.');
  }
  return data.session;
}

export async function signInWithTestId(testId: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: testIdToEmail(testId),
    password,
  });
  if (error) throw authError(error);
  if (data.user.app_metadata?.admin_role === 'super_admin') {
    await requireClient().auth.signOut();
    throw new Error('Use administrator login.');
  }
  return data.session;
}

export async function signUpWithPhonePassword(phoneNumber: string, password: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const { data, error } = await requireClient().auth.signUp({
    phone,
    password,
    options: { channel: 'sms' },
  });
  if (error) throw authError(error);
  return { phone, session: data.session };
}

export async function requestSignUpPhoneOtp(phoneNumber: string, temporaryPassword?: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const { data, error } = await requireClient().auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
      channel: 'sms',
    },
  });
  if (error) throw authError(error);
  return { phone, session: data.session, temporaryPassword: temporaryPassword ?? '' };
}

export async function checkPhoneSignUpStatus(phoneNumber: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const { data, error } = await requireClient().rpc('check_phone_signup_status', {
    p_phone: phone,
  });
  if (error) throw authError(error);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    phone,
    canSignUp: Boolean(row?.can_signup ?? true),
    reason: String(row?.reason ?? 'ok'),
  };
}

export async function requestPasswordRecoveryOtp(phoneNumber: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const { error } = await requireClient().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error) throw authError(error);
  return phone;
}

export async function resendPhoneOtp(phone: string) {
  const { error } = await requireClient().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error) throw authError(error);
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await requireClient().auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw authError(error);
  return data.session;
}

export async function updateCurrentUserPassword(password: string) {
  const { data, error } = await requireClient().auth.updateUser({ password });
  if (error) throw authError(error);
  return data.user;
}

async function changeCurrentUserPasswordLegacy(currentPassword: string, newPassword: string) {
  const client = requireClient();
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
    await Promise.all([client.auth.getSession(), client.auth.getUser()]);
  if (sessionError) throw authError(sessionError);
  if (userError) throw authError(userError);

  const { data: contactData } = await client.rpc('get_my_auth_contact').maybeSingle();
  const contact = contactData as { phone?: string | null; email?: string | null } | null;
  const phone =
    sessionData.session?.user?.phone ??
    userData.user?.phone ??
    contact?.phone ??
    (typeof sessionData.session?.user?.user_metadata?.phone === 'string'
      ? sessionData.session.user.user_metadata.phone
      : null);
  const email =
    sessionData.session?.user?.email ??
    userData.user?.email ??
    contact?.email ??
    null;

  if (!phone && !email) throw new Error('인증 전화번호를 확인할 수 없습니다.');

  const { error: signInError } = phone
    ? await client.auth.signInWithPassword({ phone, password: currentPassword })
    : await client.auth.signInWithPassword({ email: email!, password: currentPassword });
  if (signInError) throw new Error('현재 사용 중인 비밀번호가 아닙니다.');

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw authError(error);
  return data.user;
}

export async function changeCurrentUserPassword(currentPassword: string, newPassword: string) {
  const client = requireClient();
  const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] =
    await Promise.all([client.auth.getSession(), client.auth.getUser()]);
  if (sessionError) throw authError(sessionError);
  if (userError) throw authError(userError);

  const { data: contactData } = await client.rpc('get_my_auth_contact').maybeSingle();
  const contact = contactData as { phone?: string | null; email?: string | null } | null;
  const sessionUser = sessionData.session?.user;
  const authUser = userData.user;
  const phone =
    sessionUser?.phone ??
    authUser?.phone ??
    contact?.phone ??
    (typeof sessionUser?.user_metadata?.phone === 'string'
      ? sessionUser.user_metadata.phone
      : null) ??
    (typeof authUser?.user_metadata?.phone === 'string'
      ? authUser.user_metadata.phone
      : null);
  const email =
    sessionUser?.email ??
    authUser?.email ??
    contact?.email ??
    (typeof sessionUser?.user_metadata?.email === 'string'
      ? sessionUser.user_metadata.email
      : null) ??
    (typeof authUser?.user_metadata?.email === 'string'
      ? authUser.user_metadata.email
      : null);

  if (!phone && !email) throw new Error('인증 전화번호 또는 계정 ID를 확인할 수 없습니다.');

  const { error: signInError } = phone
    ? await client.auth.signInWithPassword({ phone, password: currentPassword })
    : await client.auth.signInWithPassword({ email: email!, password: currentPassword });
  if (signInError) throw new Error('현재 사용 중인 비밀번호가 아닙니다.');

  const { data, error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw authError(error);
  return data.user;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw authError(error);
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  try {
    const { unregisterPushDevice } = await import('./notifications');
    await unregisterPushDevice();
  } catch {
    // Push-token cleanup is best effort. The local logout must still proceed.
  }
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (!error) return;
  try {
    await supabase.auth.signOut();
  } catch {
    // Logging out should not trap the user in the app when the network or
    // remote session cleanup fails. The local session is the UX boundary here.
  }
}
