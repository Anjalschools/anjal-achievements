type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const DEFAULT_TTL_MS = 120_000;

export const alumniAiCacheGet = <T>(key: string): T | null => {
  const row = store.get(key);
  if (!row || Date.now() > row.expires) {
    if (row) store.delete(key);
    return null;
  }
  return row.value as T;
};

export const alumniAiCacheSet = (key: string, value: unknown, ttlMs = DEFAULT_TTL_MS) => {
  store.set(key, { value, expires: Date.now() + ttlMs });
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now > v.expires) store.delete(k);
    }
  }
};

export const alumniAiCacheKey = (parts: string[]): string => parts.join("|").slice(0, 900);
