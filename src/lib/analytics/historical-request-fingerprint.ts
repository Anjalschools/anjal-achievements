/**
 * Unified historical request fingerprint — dedupe & recompute gates.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { stableAnalyticsHash } from "@/lib/analytics/analytics-historical-cache-v2";
import { buildDeterministicFilterHash } from "@/lib/analytics/analytics-filter-stabilizer";

export type HistoricalRequestFingerprintInput = {
  filter: ExecutiveFilterSnapshot;
  years: number[];
  dimension: HistoricalDimensionSlice;
  familyKey?: string;
  displayMode?: string;
  outcomeTokens?: string[];
};

export const buildHistoricalRequestFingerprint = (
  input: HistoricalRequestFingerprintInput
): string => {
  const y = [...input.years].sort((a, b) => a - b).join(",");
  return stableAnalyticsHash({
    f: buildDeterministicFilterHash(input.filter),
    y,
    d: input.dimension,
    fam: input.familyKey ?? "all",
    mode: input.displayMode ?? "executive",
    out: (input.outcomeTokens ?? []).join(","),
    v: "hist-v2",
  });
};

export const historicalIntelligenceFingerprint = (
  requestFp: string,
  tableCount: number,
  sliceHash: string
): string =>
  stableAnalyticsHash({
    req: requestFp,
    tables: String(tableCount),
    slices: sliceHash,
  });
