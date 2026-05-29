/**
 * Client SWR cache governance — LRU cap, stale purge, metrics.
 */

import {
  recordExecCacheHit,
  recordExecCacheMiss,
  recordExecRuntimeWarning,
} from "@/lib/analytics/runtime/runtime-health-registry";

export const ANALYTICS_CACHE_MAX_ENTRIES = 120;
export const ANALYTICS_CACHE_DEFAULT_TTL_MS = 10 * 60_000;
export const ANALYTICS_CACHE_DEFAULT_STALE_MS = 60_000;

export type AnalyticsCacheMetrics = {
  hits: number;
  misses: number;
  evictions: number;
  stalePurges: number;
  size: number;
};

const metrics: AnalyticsCacheMetrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  stalePurges: 0,
  size: 0,
};

export const getAnalyticsCacheMetrics = (): AnalyticsCacheMetrics => ({ ...metrics });

export const recordAnalyticsCacheHit = (): void => {
  metrics.hits += 1;
  recordExecCacheHit();
};

export const recordAnalyticsCacheMiss = (): void => {
  metrics.misses += 1;
  recordExecCacheMiss();
};

export const recordAnalyticsCacheEvict = (key: string, reason: "lru" | "ttl" | "namespace"): void => {
  metrics.evictions += 1;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[CACHE_EVICT]", { key, reason });
  }
  recordExecRuntimeWarning("[CACHE_EVICT]", { key, reason });
};

export const recordAnalyticsStalePurge = (count: number): void => {
  metrics.stalePurges += count;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[CACHE_STALE_PURGE]", { count });
  }
  recordExecRuntimeWarning("[CACHE_STALE_PURGE]", { count });
};

export const setAnalyticsCacheSize = (size: number): void => {
  metrics.size = size;
};
