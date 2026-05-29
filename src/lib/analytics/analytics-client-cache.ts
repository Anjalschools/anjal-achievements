/**
 * Client-side stale-while-revalidate cache for analytics option endpoints and snapshots.
 */

import { fetchInflightDeduped } from "@/lib/analytics/runtime/analytics-inflight-registry";
import {
  ANALYTICS_CACHE_DEFAULT_STALE_MS,
  ANALYTICS_CACHE_DEFAULT_TTL_MS,
  ANALYTICS_CACHE_MAX_ENTRIES,
  recordAnalyticsCacheEvict,
  recordAnalyticsCacheHit,
  recordAnalyticsCacheMiss,
  recordAnalyticsStalePurge,
  setAnalyticsCacheSize,
} from "@/lib/analytics/runtime/analytics-cache-governance";

type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
  key: string;
  lastAccess: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export type SwrFetchOptions = {
  ttlMs?: number;
  staleMs?: number;
};

export { ANALYTICS_CACHE_DEFAULT_TTL_MS, ANALYTICS_CACHE_DEFAULT_STALE_MS, ANALYTICS_CACHE_MAX_ENTRIES };

export const buildAnalyticsCacheKey = (namespace: string, params: Record<string, string>): string => {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${namespace}:${sorted}`;
};

const purgeExpiredEntries = (ttlMs: number): void => {
  const now = Date.now();
  let purged = 0;
  for (const [key, entry] of store) {
    if (now - entry.fetchedAt > ttlMs) {
      store.delete(key);
      purged += 1;
      recordAnalyticsCacheEvict(key, "ttl");
    }
  }
  if (purged) recordAnalyticsStalePurge(purged);
  setAnalyticsCacheSize(store.size);
};

const evictLru = (): void => {
  if (store.size <= ANALYTICS_CACHE_MAX_ENTRIES) return;
  const sorted = [...store.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
  const drop = store.size - ANALYTICS_CACHE_MAX_ENTRIES;
  for (let i = 0; i < drop; i++) {
    const key = sorted[i]![0];
    store.delete(key);
    recordAnalyticsCacheEvict(key, "lru");
  }
  setAnalyticsCacheSize(store.size);
};

export const readAnalyticsCache = <T>(key: string): CacheEntry<T> | null => {
  const hit = store.get(key);
  if (!hit) return null;
  hit.lastAccess = Date.now();
  return hit as CacheEntry<T>;
};

export const writeAnalyticsCache = <T>(key: string, data: T): void => {
  store.set(key, { data, fetchedAt: Date.now(), key, lastAccess: Date.now() });
  evictLru();
  setAnalyticsCacheSize(store.size);
};

export const invalidateAnalyticsCache = (namespacePrefix?: string): void => {
  if (!namespacePrefix) {
    const n = store.size;
    store.clear();
    if (n) recordAnalyticsStalePurge(n);
    setAnalyticsCacheSize(0);
    return;
  }
  let purged = 0;
  for (const k of store.keys()) {
    if (k.startsWith(`${namespacePrefix}:`)) {
      store.delete(k);
      purged += 1;
      recordAnalyticsCacheEvict(k, "namespace");
    }
  }
  if (purged) recordAnalyticsStalePurge(purged);
  setAnalyticsCacheSize(store.size);
};

/**
 * Returns cached data immediately when fresh; revalidates in background when stale.
 */
export const fetchWithAnalyticsSwr = async <T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  opts?: SwrFetchOptions
): Promise<{ data: T; fromCache: boolean; stale: boolean }> => {
  const ttlMs = opts?.ttlMs ?? ANALYTICS_CACHE_DEFAULT_TTL_MS;
  const staleMs = opts?.staleMs ?? ANALYTICS_CACHE_DEFAULT_STALE_MS;
  const now = Date.now();
  purgeExpiredEntries(ttlMs);
  const cached = readAnalyticsCache<T>(key);

  if (cached && now - cached.fetchedAt < ttlMs) {
    recordAnalyticsCacheHit();
    if (now - cached.fetchedAt > staleMs) {
      void fetchInflightDeduped(`${key}:revalidate`, fetcher).then((data) =>
        writeAnalyticsCache(key, data)
      );
    }
    return { data: cached.data, fromCache: true, stale: now - cached.fetchedAt > staleMs };
  }

  recordAnalyticsCacheMiss();
  const data = await fetchInflightDeduped(key, fetcher);
  writeAnalyticsCache(key, data);
  return { data, fromCache: false, stale: false };
};
