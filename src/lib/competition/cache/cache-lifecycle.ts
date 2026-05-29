/**
 * Intelligent cache governance — soft expiry, stale-while-revalidate, snapshot fallback.
 */

import type { CiTrustLevel } from "@/lib/competition-intelligence-consistency";

export type CiCacheLifecycleStatus = "fresh" | "stale" | "expired" | "snapshot_fallback";

export type CiCacheEntry<T> = {
  at: number;
  payload: T;
  trustLevel?: CiTrustLevel;
};

export type CiCacheLifecycleConfig = {
  softTtlMs: number;
  staleTtlMs: number;
  maxEntries: number;
};

export const DEFAULT_CI_CACHE_CONFIG: CiCacheLifecycleConfig = {
  softTtlMs: 45_000,
  staleTtlMs: 120_000,
  maxEntries: 80,
};

export type CiCacheResolveResult<T> = {
  hit: boolean;
  status: CiCacheLifecycleStatus;
  payload?: T;
  ageMs: number;
  shouldRevalidate: boolean;
  trustAwareStatus: CiTrustLevel;
};

export class CiRouteMemoryCache<T> {
  private store = new Map<string, CiCacheEntry<T>>();
  private readonly config: CiCacheLifecycleConfig;

  constructor(config: Partial<CiCacheLifecycleConfig> = {}) {
    this.config = { ...DEFAULT_CI_CACHE_CONFIG, ...config };
  }

  get(key: string, trustLevel: CiTrustLevel = "synced"): CiCacheResolveResult<T> {
    const hit = this.store.get(key);
    const now = Date.now();
    if (!hit) {
      return {
        hit: false,
        status: "expired",
        ageMs: 0,
        shouldRevalidate: true,
        trustAwareStatus: trustLevel,
      };
    }
    const ageMs = now - hit.at;
    if (ageMs <= this.config.softTtlMs) {
      return {
        hit: true,
        status: "fresh",
        payload: hit.payload,
        ageMs,
        shouldRevalidate: false,
        trustAwareStatus: hit.trustLevel ?? trustLevel,
      };
    }
    if (ageMs <= this.config.staleTtlMs) {
      return {
        hit: true,
        status: "stale",
        payload: hit.payload,
        ageMs,
        shouldRevalidate: true,
        trustAwareStatus: hit.trustLevel ?? trustLevel,
      };
    }
    this.store.delete(key);
    return {
      hit: false,
      status: "expired",
      ageMs,
      shouldRevalidate: true,
      trustAwareStatus: trustLevel,
    };
  }

  set(key: string, payload: T, trustLevel?: CiTrustLevel) {
    this.store.set(key, { at: Date.now(), payload, trustLevel });
    this.evict();
  }

  invalidatePrefix(prefix: string) {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k);
    }
  }

  invalidateKey(key: string) {
    this.store.delete(key);
  }

  private evict() {
    if (this.store.size <= this.config.maxEntries) return;
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (now - v.at > this.config.staleTtlMs) {
        this.store.delete(k);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("[CACHE_STALE_PURGE]", { key: k, cache: "route" });
        }
      }
    }
    if (this.store.size > this.config.maxEntries) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].at - b[1].at);
      const drop = this.store.size - this.config.maxEntries;
      for (let i = 0; i < drop; i++) {
        const key = oldest[i]![0];
        this.store.delete(key);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.info("[CACHE_EVICT]", { key, reason: "lru", cache: "route" });
        }
      }
    }
  }
}

export type SnapshotFallbackMeta = {
  snapshotId: string;
  periodStart: string;
  aggregationVersion: number;
  trustStatus: string;
};
