/**
 * Client-side multi-year fetch — preserves API contract (same endpoint/shape per year).
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import {
  buildAnalyticsCacheKey,
  fetchWithAnalyticsSwr,
} from "@/lib/analytics/analytics-client-cache";

export type HistoricalDimensionSlice = "combined" | "girls" | "boys";

export type HistoricalYearSlice = {
  year: number;
  payload: ParticipationAnalyticsPayload;
};

const applyDimensionToFilter = (
  base: ExecutiveFilterSnapshot,
  dimension: HistoricalDimensionSlice
): ExecutiveFilterSnapshot => {
  if (dimension === "combined") return { ...base, genders: [], gender: "all" };
  if (dimension === "girls") {
    return { ...base, genders: ["female"], gender: "female" };
  }
  return { ...base, genders: ["male"], gender: "male" };
};

const filterForCalendarYear = (
  base: ExecutiveFilterSnapshot,
  year: number
): ExecutiveFilterSnapshot => ({
  ...base,
  academicYear: `${year}-${year + 1}م`,
  activityYears: [String(year)],
});

const fetchParticipationPage = async (
  params: URLSearchParams
): Promise<ParticipationAnalyticsPayload> => {
  const res = await fetch(`/api/admin/reports/achievement-participation?${params.toString()}`);
  if (!res.ok) throw new Error("Historical fetch failed");
  return (await res.json()) as ParticipationAnalyticsPayload;
};

export const fetchParticipationForYear = async (
  baseFilter: ExecutiveFilterSnapshot,
  year: number,
  dimension: HistoricalDimensionSlice = "combined"
): Promise<ParticipationAnalyticsPayload> => {
  const f = applyDimensionToFilter(filterForCalendarYear(baseFilter, year), dimension);
  const baseParams = buildParticipationFilterSearchParams(f);
  baseParams.set("pageSize", "100");

  const key = buildAnalyticsCacheKey("hist-year", {
    year: String(year),
    dim: dimension,
    hash: baseParams.toString(),
  });

  const { data } = await fetchWithAnalyticsSwr(
    key,
    async (_signal) => {
      baseParams.set("page", "1");
      const first = await fetchParticipationPage(baseParams);
      const allRows = [...(first.table ?? [])];
      const pageSize = first.pageSize || 100;
      const total = first.tableTotal ?? allRows.length;
      const maxPages = Math.min(20, Math.ceil(total / pageSize));

      for (let page = 2; page <= maxPages; page += 1) {
        if (allRows.length >= total) break;
        const p = new URLSearchParams(baseParams);
        p.set("page", String(page));
        const next = await fetchParticipationPage(p);
        allRows.push(...(next.table ?? []));
      }

      return { ...first, table: allRows, page: 1, pageSize: allRows.length };
    },
    { ttlMs: 5 * 60_000, staleMs: 30_000 }
  );

  return data;
};

let historicalFetchChain: Promise<void> = Promise.resolve();

const enqueueHistoricalFetch = <T>(task: () => Promise<T>): Promise<T> => {
  const run = historicalFetchChain.then(task, task);
  historicalFetchChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

export const fetchHistoricalYearSlices = async (
  baseFilter: ExecutiveFilterSnapshot,
  years: number[],
  dimension: HistoricalDimensionSlice = "combined"
): Promise<HistoricalYearSlice[]> => {
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const results = await enqueueHistoricalFetch(() =>
    Promise.all(
      sorted.map(async (year) => ({
        year,
        payload: await fetchParticipationForYear(baseFilter, year, dimension),
      }))
    )
  );
  return results;
};

export const DEFAULT_HISTORICAL_YEARS = [2021, 2022, 2023, 2024, 2025];

export const normalizeHistoricalYears = (years: number[]): number[] => {
  const valid = years.filter((y) => y >= 2018 && y <= 2030);
  return valid.length > 0 ? [...new Set(valid)].sort((a, b) => a - b) : DEFAULT_HISTORICAL_YEARS;
};
