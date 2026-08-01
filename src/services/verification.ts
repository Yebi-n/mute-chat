import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type VerificationStatus = {
  identityVerified: boolean;
  adultVerified: boolean;
  provider: string | null;
  adultContentWebOptedIn: boolean;
  iosAdultContentEnabled: boolean;
};

export async function getVerificationStatus(): Promise<VerificationStatus> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      identityVerified: false,
      adultVerified: false,
      provider: null,
      adultContentWebOptedIn: false,
      iosAdultContentEnabled: false,
    };
  }

  const { data, error } = await supabase.rpc('get_my_verification_status');
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    identityVerified: Boolean(row?.identity_verified),
    adultVerified: Boolean(row?.adult_verified),
    provider: row?.identity_provider ?? null,
    adultContentWebOptedIn: Boolean(row?.adult_content_web_opted_in),
    iosAdultContentEnabled: Boolean(row?.ios_adult_content_enabled),
  };
}

export async function setAdultContentAccess(enabled: boolean) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase environment is not configured.');
  }

  const { error } = await supabase.rpc('set_adult_content_access', {
    p_enabled: enabled,
  });
  if (error) throw error;
}

export function getOperationsPolicyUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_OPERATIONS_POLICY_URL?.trim();
  if (!baseUrl) {
    throw new Error('OPERATIONS_POLICY_URL_NOT_CONFIGURED');
  }
  return baseUrl;
}

export async function startAdultVerification() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase environment is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('start-adult-verification', {
    body: { returnUrl: 'mute://adult-verification-complete' },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('ADULT_VERIFICATION_PROVIDER_NOT_CONFIGURED');
  return data.url as string;
}
