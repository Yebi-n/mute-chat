import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AppNotice = {
  id: string;
  body: string;
  priority: number;
};

export async function listActiveAppNotices() {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase.rpc('list_active_app_notices');
  if (error) throw error;
  return ((data ?? []) as { id: string; body: string; priority: number | string }[])
    .map((row) => ({
      id: row.id,
      body: row.body,
      priority: Number(row.priority),
    }))
    .filter((notice) => notice.body.trim().length > 0);
}
