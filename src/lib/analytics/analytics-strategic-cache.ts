/**
 * Strategic intelligence caches — cube, trend, funnel TTL memoization.
 */

type CacheEntry<T> = { data: T; at: number; key: string };

const stores = {
  cube: new Map<string, CacheEntry<unknown>>(),
  trend: new Map<string, CacheEntry<unknown>>(),
  funnel: new Map<string, CacheEntry<unknown>>(),
  historical: new Map<string, CacheEntry<unknown>>(),
} as const;

export type StrategicCacheNamespace = keyof typeof stores;

const TTL_MS: Record<StrategicCacheNamespace, number> = {
  cube: 5 * 60_000,
  trend: 10 * 60_000,
  funnel: 5 * 60_000,
  historical: 8 * 60_000,
};

export const strategicCacheKey = (parts: Record<string, string>): string =>
  Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");

export const readStrategicCache = <T>(ns: StrategicCacheNamespace, key: string): T | null => {
  const hit = stores[ns].get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS[ns]) {
    stores[ns].delete(key);
    return null;
  }
  return hit.data as T;
};

export const writeStrategicCache = <T>(ns: StrategicCacheNamespace, key: string, data: T): void => {
  stores[ns].set(key, { data, at: Date.now(), key });
};

export const memoizeStrategic = <T>(
  ns: StrategicCacheNamespace,
  key: string,
  factory: () => T
): T => {
  const cached = readStrategicCache<T>(ns, key);
  if (cached !== null) return cached;
  const data = factory();
  writeStrategicCache(ns, key, data);
  return data;
};

export const invalidateStrategicCache = (ns?: StrategicCacheNamespace): void => {
  if (!ns) {
    for (const k of Object.keys(stores) as StrategicCacheNamespace[]) {
      stores[k].clear();
    }
    return;
  }
  stores[ns].clear();
};
