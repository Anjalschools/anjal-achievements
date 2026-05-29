/**
 * Historical query deduplication — shared fetch/aggregation across components.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { buildHistoricalRequestFingerprint } from "@/lib/analytics/historical-request-fingerprint";

type DedupEntry<T> = {
  promise: Promise<T>;
  at: number;
};

const inflight = new Map<string, DedupEntry<unknown>>();
const results = new Map<string, { value: unknown; at: number }>();
const TTL_MS = 60_000;

const dedupKey = (
  filter: ExecutiveFilterSnapshot,
  years: number[],
  dimension: HistoricalDimensionSlice = "combined",
  familyKey = "all"
): string =>
  buildHistoricalRequestFingerprint({ filter, years, dimension, familyKey });

export const deduplicateHistoricalQuery = async <T>(
  filter: ExecutiveFilterSnapshot,
  years: number[],
  factory: () => Promise<T>,
  opts?: { dimension?: HistoricalDimensionSlice; familyKey?: string }
): Promise<T> => {
  const key = dedupKey(filter, years, opts?.dimension ?? "combined", opts?.familyKey ?? "all");
  const cached = results.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return cached.value as T;
  }

  const pending = inflight.get(key);
  if (pending) return pending.promise as Promise<T>;

  const promise = factory()
    .then((value) => {
      results.set(key, { value, at: Date.now() });
      inflight.delete(key);
      return value;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });

  inflight.set(key, { promise, at: Date.now() });
  return promise as Promise<T>;
};

export const peekHistoricalDedupCache = (
  filter: ExecutiveFilterSnapshot,
  years: number[],
  dimension: HistoricalDimensionSlice = "combined"
): HistoricalYearSlice[] | null => {
  const key = dedupKey(filter, years, dimension);
  const cached = results.get(key);
  if (!cached || Date.now() - cached.at >= TTL_MS) return null;
  return cached.value as HistoricalYearSlice[];
};

export const clearHistoricalQueryDedup = (): void => {
  inflight.clear();
  results.clear();
};
