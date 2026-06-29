import { isSupabaseConfigured, supabase } from '../lib/supabase';

type CacheEntry = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 50 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_CACHE_ENTRIES = 2000;

function cacheKey(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

function pruneCache(now: number) {
  for (const [key, entry] of signedUrlCache) {
    if (entry.expiresAt <= now) signedUrlCache.delete(key);
  }
  if (signedUrlCache.size <= MAX_CACHE_ENTRIES) return;
  const overflow = signedUrlCache.size - MAX_CACHE_ENTRIES;
  [...signedUrlCache.keys()].slice(0, overflow).forEach((key) =>
    signedUrlCache.delete(key),
  );
}

export async function getCachedSignedUrls(
  bucket: string,
  paths: Array<string | null | undefined>,
) {
  if (!isSupabaseConfigured || !supabase) return new Map<string, string>();
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!uniquePaths.length) return new Map<string, string>();

  const now = Date.now();
  pruneCache(now);
  const result = new Map<string, string>();
  const missing: string[] = [];
  uniquePaths.forEach((path) => {
    const cached = signedUrlCache.get(cacheKey(bucket, path));
    if (cached && cached.expiresAt > now) result.set(path, cached.url);
    else missing.push(path);
  });

  if (missing.length) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(missing, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    data?.forEach((row, index) => {
      if (!row.signedUrl) return;
      const path = missing[index];
      result.set(path, row.signedUrl);
      signedUrlCache.set(cacheKey(bucket, path), {
        url: row.signedUrl,
        expiresAt: now + CACHE_TTL_MS,
      });
    });
  }
  return result;
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}
