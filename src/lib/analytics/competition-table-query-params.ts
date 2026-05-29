/**
 * Single filter → URLSearchParams contract for competition-table-engine APIs.
 */
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
import type { HistoricalDimensionSlice } from "@/lib/analytics/historical-comparison-fetch";
import { stableYearsKey } from "@/lib/analytics/historical-analytics-stable";

export type CompetitionTableQueryInput = {
  filter: ExecutiveFilterSnapshot;
  competitionKey: string;
  years: number[];
  dimension?: HistoricalDimensionSlice;
};

/** Apply historical boys/girls dimension onto filter snapshot (same as historical slices). */
export const applyHistoricalDimensionToFilter = (
  base: ExecutiveFilterSnapshot,
  dimension: HistoricalDimensionSlice = "combined"
): ExecutiveFilterSnapshot => {
  if (dimension === "combined") return { ...base, genders: [], gender: "all" };
  if (dimension === "girls") {
    return { ...base, genders: ["female"], gender: "female" };
  }
  return { ...base, genders: ["male"], gender: "male" };
};

export const buildCompetitionTableQueryParams = (
  input: CompetitionTableQueryInput
): URLSearchParams => {
  const effectiveFilter = applyHistoricalDimensionToFilter(
    input.filter,
    input.dimension ?? "combined"
  );
  const params = buildParticipationFilterSearchParams(effectiveFilter);
  params.set("competition", input.competitionKey);
  params.set("years", [...input.years].sort((a, b) => a - b).join(","));
  if (input.dimension) params.set("dimension", input.dimension);
  return params;
};

export const buildCompetitionTableQueryKey = (input: CompetitionTableQueryInput): string => {
  const params = buildCompetitionTableQueryParams(input);
  return ["competition-table", input.competitionKey, stableYearsKey(input.years), params.toString()].join(
    "|"
  );
};
