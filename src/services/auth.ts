import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  return supabase;
}

export function normalizeKoreanPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('82')) return `+${digits}`;
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`;
  return `+82${digits}`;
}

function generateTemporaryPassword() {
  const bytes = new Uint8Array(24);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `Mute!${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export async function signInWithPhonePassword(phoneNumber: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    phone: normalizeKoreanPhoneNumber(phoneNumber),
    password,
  });
  if (error) throw error;
  return data.session;
}

export function adminIdToEmail(adminId: string) {
  const normalized = adminId.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{2,31}$/.test(normalized)) {
    throw new Error('Invalid administrator ID.');
  }
  return `${normalized}@admin.mute.app`;
}

export async function signInWithAdminId(adminId: string, password: string) {
  const { data, error } = await requireClient().auth.signInWithPassword({
    email: adminIdToEmail(adminId),
    password,
  });
  if (error) throw error;
  if (data.user.app_metadata?.admin_role !== 'super_admin') {
    await requireClient().auth.signOut();
    throw new Error('Administrator permission is required.');
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
  if (error) throw error;
  return { phone, session: data.session };
}

export async function requestSignUpPhoneOtp(phoneNumber: string, temporaryPassword?: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const signupPassword = temporaryPassword ?? generateTemporaryPassword();
  const { data, error } = await requireClient().auth.signUp({
    phone,
    password: signupPassword,
    options: { channel: 'sms' },
  });
  if (error) throw error;
  return { phone, session: data.session, temporaryPassword: signupPassword };
}

export async function requestPasswordRecoveryOtp(phoneNumber: string) {
  const phone = normalizeKoreanPhoneNumber(phoneNumber);
  const { error } = await requireClient().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
  return phone;
}

export async function resendPhoneOtp(phone: string) {
  const { error } = await requireClient().auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await requireClient().auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data.session;
}

export async function updateCurrentUserPassword(password: string) {
  const { data, error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
  return data.user;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}
