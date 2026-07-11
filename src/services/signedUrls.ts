import { isSupabaseConfigured, supabase } from '../lib/supabase';

type CacheEntry = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 50 * 60 * 1000;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_CACHE_ENTRIES = 2000;

function cacheKey(bucket: string, path: string) {
  return `${bucket}:${path}`;
}

function normalizeAssetPath(path: string | null | undefined) {
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  return trimmed.length ? trimmed : null;
}

function isRemoteAssetUrl(path: string) {
  return /^https?:\/\//i.test(path);
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
  const normalizedPairs = paths
    .map((original) => ({ original, normalized: normalizeAssetPath(original) }))
    .filter((entry): entry is { original: string | null | undefined; normalized: string } => Boolean(entry.normalized));
  const uniquePaths = [...new Set(normalizedPairs.map((entry) => entry.normalized))];
  if (!uniquePaths.length) return new Map<string, string>();

  const now = Date.now();
  pruneCache(now);
  const result = new Map<string, string>();
  const missing: string[] = [];
  uniquePaths.forEach((path) => {
    if (isRemoteAssetUrl(path)) {
      result.set(path, path);
      return;
    }
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

  for (const { original, normalized } of normalizedPairs) {
    if (typeof original !== 'string') continue;
    const resolved = result.get(normalized);
    if (resolved) result.set(original, resolved);
  }

  return result;
}

export function clearSignedUrlCache() {
  signedUrlCache.clear();
}
