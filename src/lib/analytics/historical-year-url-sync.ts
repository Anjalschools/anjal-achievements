/**
 * Historical years URL sync — ?historicalYears=2021,2022,2024
 * Backward compatible with activityYears / filterActivityYear.
 */

import { normalizeHistoricalYears } from "@/lib/analytics/historical-comparison-fetch";

export const HISTORICAL_YEARS_PARAM = "historicalYears";

export const parseHistoricalYearsFromSearchParams = (
  params: URLSearchParams
): number[] => {
  const direct = params.get(HISTORICAL_YEARS_PARAM);
  if (direct) {
    const parsed = direct
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((y) => Number.isFinite(y) && y >= 2018 && y <= 2035);
    if (parsed.length > 0) return normalizeHistoricalYears(parsed);
  }

  const legacy = params.get("activityYears") ?? params.get("filterActivityYear");
  if (legacy) {
    const parsed = legacy
      .split(",")
      .map((s) => parseInt(String(s).replace(/[^\d]/g, ""), 10))
      .filter((y) => Number.isFinite(y) && y >= 2018 && y <= 2035);
    if (parsed.length > 0) return normalizeHistoricalYears(parsed);
  }

  return [];
};

export const serializeHistoricalYearsToSearchParams = (
  years: number[],
  params: URLSearchParams
): URLSearchParams => {
  const normalized = normalizeHistoricalYears(years);
  const next = new URLSearchParams(params.toString());
  if (normalized.length > 0) {
    next.set(HISTORICAL_YEARS_PARAM, normalized.join(","));
    next.set("activityYears", normalized.join(","));
  } else {
    next.delete(HISTORICAL_YEARS_PARAM);
  }
  return next;
};

export const discoverAvailableHistoricalYears = (
  slices: Array<{ year: number }>,
  filterActivityYears: string[] = []
): number[] => {
  const years = new Set<number>();

  for (const s of slices) years.add(s.year);
  for (const y of filterActivityYears) {
    const n = parseInt(String(y).replace(/[^\d]/g, ""), 10);
    if (Number.isFinite(n) && n >= 2018 && n <= 2035) years.add(n);
  }

  const current = new Date().getFullYear();
  if (years.size === 0) {
    for (let y = current - 4; y <= current; y += 1) years.add(y);
  }

  return [...years].sort((a, b) => a - b);
};
