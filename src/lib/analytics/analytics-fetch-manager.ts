/**
 * Analytics fetch manager — abort, dedupe, stale-while-revalidate.
 */

type CacheEntry<T> = { data: T; at: number };

const cache = new Map<string, CacheEntry<unknown>>();
const controllers = new Map<string, AbortController>();

export const analyticsFetch = async <T>(
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  opts?: { ttlMs?: number; reuseStale?: boolean }
): Promise<T> => {
  const ttl = opts?.ttlMs ?? 30_000;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    return hit.data as T;
  }

  const prev = controllers.get(key);
  prev?.abort();
  const controller = new AbortController();
  controllers.set(key, controller);

  try {
    const data = await fetcher(controller.signal);
    cache.set(key, { data, at: Date.now() });
    return data;
  } catch (e) {
    if (opts?.reuseStale && hit) return hit.data as T;
    throw e;
  } finally {
    if (controllers.get(key) === controller) controllers.delete(key);
  }
};

export const abortAnalyticsFetch = (key: string): void => {
  controllers.get(key)?.abort();
  controllers.delete(key);
};
