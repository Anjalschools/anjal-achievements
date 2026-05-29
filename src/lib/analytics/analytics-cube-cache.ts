/**
 * Cube computation cache — LRU with stable fingerprints.
 */

import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";

const LOG = process.env.NODE_ENV !== "production";

const MAX_ENTRIES = 48;
const cache = new Map<string, unknown>();

export type CubeCacheKeyInput = {
  years: number[];
  dimensions: string[];
  metrics: string[];
  perspective?: string;
  filterHash: string;
  aggregationStrategy?: string;
};

export const cubeComputationFingerprint = (input: CubeCacheKeyInput): string =>
  stableAnalyticsHash({
    y: [...input.years].sort((a, b) => a - b).join(","),
    d: input.dimensions.join(","),
    m: input.metrics.join(","),
    p: input.perspective ?? "",
    f: input.filterHash,
    a: input.aggregationStrategy ?? "default",
  });

export const readCubeCache = <T>(key: string): T | undefined => {
  const hit = cache.get(key);
  if (LOG) diagnostics.cacheHits += hit ? 1 : 0;
  if (!hit) diagnostics.cacheMisses += 1;
  return hit as T | undefined;
};

export const writeCubeCache = <T>(key: string, value: T): void => {
  if (cache.size >= MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, value);
};

export const clearCubeCache = (): void => {
  cache.clear();
};

export const diagnostics = {
  cacheHits: 0,
  cacheMisses: 0,
  buildMs: 0,
};

export const recordCubeBuildDuration = (ms: number): void => {
  diagnostics.buildMs = ms;
  if (LOG && ms > 50) {
    // eslint-disable-next-line no-console
    console.info("[analytics-cube] slow build", { ms, hits: diagnostics.cacheHits });
  }
};
