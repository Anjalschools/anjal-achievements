/**
 * Historical filter resolution pipeline — normalized filters for all historical layers.
 */

import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import {
  resolveHistoricalCompatibleFilters,
  type HistoricalDimensionRelaxation,
  type HistoricalQueryFingerprint,
} from "@/lib/analytics/historical-query-resolution";
import { buildHistoricalRequestFingerprint } from "@/lib/analytics/historical-request-fingerprint";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { expandResultTokens } from "@/lib/analytics/historical-compatibility-registry";

export type ResolvedHistoricalFilters = {
  /** Used for API fetch — preserves user intent */
  fetch: ExecutiveFilterSnapshot;
  /** Relaxed cross-year compatible filters */
  compatible: ExecutiveFilterSnapshot;
  /** Filters for narratives / exports (result tokens expanded) */
  narrative: ExecutiveFilterSnapshot;
  fingerprint: string;
  queryFingerprint: HistoricalQueryFingerprint;
  relaxation: HistoricalDimensionRelaxation;
};

const withExpandedResults = (f: ExecutiveFilterSnapshot): ExecutiveFilterSnapshot => ({
  ...f,
  resultTokens: expandResultTokens(f.resultTokens ?? []),
});

export const resolveHistoricalFilterPipeline = (
  filter: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[],
  opts?: {
    dimension?: HistoricalDimensionSlice;
    familyKey?: string;
    displayMode?: string;
  }
): ResolvedHistoricalFilters => {
  const { filter: compatible, relaxation, fingerprint: queryFingerprint } =
    resolveHistoricalCompatibleFilters(filter, slices);

  const fetch = filter;
  const narrative = withExpandedResults(compatible);
  const fingerprint = buildHistoricalRequestFingerprint({
    filter: fetch,
    years: slices.map((s) => s.year),
    dimension: opts?.dimension ?? "combined",
    familyKey: opts?.familyKey,
    displayMode: opts?.displayMode,
  });

  return {
    fetch,
    compatible,
    narrative,
    fingerprint,
    queryFingerprint,
    relaxation,
  };
};
