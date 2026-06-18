import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type VerificationStatus = {
  identityVerified: boolean;
  adultVerified: boolean;
  provider: string | null;
};

export async function getVerificationStatus(): Promise<VerificationStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return { identityVerified: false, adultVerified: false, provider: null };
  }
  const { data, error } = await supabase.rpc('get_my_verification_status');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    identityVerified: Boolean(row?.identity_verified),
    adultVerified: Boolean(row?.adult_verified),
    provider: row?.identity_provider ?? null,
  };
}

export async function startAdultVerification() {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  const { data, error } = await supabase.functions.invoke('start-adult-verification', {
    body: { returnUrl: 'mute://adult-verification-complete' },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('ADULT_VERIFICATION_PROVIDER_NOT_CONFIGURED');
  return data.url as string;
}
