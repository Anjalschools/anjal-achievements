/**
 * Historical analytics cache v2 — LRU + dimension/year keys.
 */

type CacheNs = "funnel" | "intelligence" | "matrix" | "cube" | "bundle";

type Entry<T> = { data: T; at: number };

const MAX_ENTRIES = 48;
const TTL_MS: Record<CacheNs, number> = {
  funnel: 8 * 60_000,
  intelligence: 8 * 60_000,
  matrix: 5 * 60_000,
  cube: 5 * 60_000,
  bundle: 5 * 60_000,
};

const stores: Record<CacheNs, Map<string, Entry<unknown>>> = {
  funnel: new Map(),
  intelligence: new Map(),
  matrix: new Map(),
  cube: new Map(),
  bundle: new Map(),
};

const touchLru = <T>(map: Map<string, Entry<T>>, key: string, entry: Entry<T>): void => {
  map.delete(key);
  map.set(key, entry);
  while (map.size > MAX_ENTRIES) {
    const first = map.keys().next().value;
    if (first) map.delete(first);
  }
};

export const stableAnalyticsHash = (parts: Record<string, string | number | boolean>): string =>
  Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k]}`)
    .join("|");

export const readHistoricalCache = <T>(ns: CacheNs, key: string): T | null => {
  const hit = stores[ns].get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS[ns]) {
    stores[ns].delete(key);
    return null;
  }
  touchLru(stores[ns] as Map<string, Entry<T>>, key, hit as Entry<T>);
  return hit.data as T;
};

export const writeHistoricalCache = <T>(ns: CacheNs, key: string, data: T): void => {
  touchLru(stores[ns] as Map<string, Entry<T>>, key, { data, at: Date.now() });
};

export const invalidateHistoricalCache = (ns?: CacheNs): void => {
  if (!ns) {
    for (const k of Object.keys(stores) as CacheNs[]) stores[k].clear();
    return;
  }
  stores[ns].clear();
};
