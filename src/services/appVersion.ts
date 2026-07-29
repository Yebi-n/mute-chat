import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AppVersionPolicy = {
  platform: string;
  minBuild: number;
  latestBuild?: number | null;
  forceMessage?: string | null;
  updateUrl?: string | null;
};

export const CURRENT_APP_BUILD =
  Platform.OS === 'ios' ? 149 : Platform.OS === 'android' ? 128 : 0;

export async function getAppVersionPolicy(): Promise<AppVersionPolicy | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const { data, error } = await supabase.rpc('get_app_version_policy', {
    p_platform: platform,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  return {
    platform,
    minBuild: Number(row.minBuild ?? row.min_build ?? 0),
    latestBuild:
      row.latestBuild == null && row.latest_build == null
        ? null
        : Number(row.latestBuild ?? row.latest_build),
    forceMessage:
      typeof row.forceMessage === 'string'
        ? row.forceMessage
        : typeof row.force_message === 'string'
          ? row.force_message
          : null,
    updateUrl:
      typeof row.updateUrl === 'string'
        ? row.updateUrl
        : typeof row.update_url === 'string'
          ? row.update_url
          : null,
  };
}
