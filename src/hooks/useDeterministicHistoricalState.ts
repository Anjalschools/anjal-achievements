"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_HISTORICAL_YEARS,
  normalizeHistoricalYears,
  type HistoricalDimensionSlice,
} from "@/lib/analytics/historical-comparison-fetch";
import type { ComparisonTableMode } from "@/lib/analytics/historical-comparison-table-engine";
import {
  discoverAvailableHistoricalYears,
  parseHistoricalYearsFromSearchParams,
  serializeHistoricalYearsToSearchParams,
} from "@/lib/analytics/historical-year-url-sync";
import { stableYearsKey } from "@/lib/analytics/historical-analytics-stable";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";

export type DeterministicHistoricalState = {
  years: number[];
  yearsKey: string;
  availableYears: number[];
  mode: ComparisonTableMode;
  dimension: HistoricalDimensionSlice;
  familyKey: string;
  displayMode: HistoricalTableDisplayMode;
  setYears: (years: number[]) => void;
  setMode: (mode: ComparisonTableMode) => void;
  setDimension: (dimension: HistoricalDimensionSlice) => void;
  setFamilyKey: (key: string) => void;
  setDisplayMode: (mode: HistoricalTableDisplayMode) => void;
  selectAllYears: () => void;
  selectLastYears: (n: number) => void;
  resetYears: () => void;
};

export const useDeterministicHistoricalState = (
  filterActivityYears: string[] = [],
  slicesForDiscovery: Array<{ year: number }> = []
): DeterministicHistoricalState => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const availableYears = useMemo(
    () => discoverAvailableHistoricalYears(slicesForDiscovery, filterActivityYears),
    [slicesForDiscovery, filterActivityYears.join(",")]
  );

  const initialYears = useMemo(() => {
    const fromUrl = parseHistoricalYearsFromSearchParams(searchParams);
    if (fromUrl.length > 0) return normalizeHistoricalYears(fromUrl);
    if (filterActivityYears.length > 0) {
      return normalizeHistoricalYears(
        filterActivityYears.map((y) => parseInt(String(y), 10)).filter(Number.isFinite)
      );
    }
    return normalizeHistoricalYears(DEFAULT_HISTORICAL_YEARS);
    // searchParams identity changes — read once via stable string
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [years, setYearsState] = useState<number[]>(initialYears);
  const [mode, setMode] = useState<ComparisonTableMode>("historical");
  const [dimension, setDimension] = useState<HistoricalDimensionSlice>("combined");
  const [familyKey, setFamilyKey] = useState<string>("all");
  const [displayMode, setDisplayMode] = useState<HistoricalTableDisplayMode>("executive");

  const yearsKey = stableYearsKey(years);

  const syncUrl = useCallback(
    (nextYears: number[]) => {
      const params = serializeHistoricalYearsToSearchParams(
        nextYears,
        new URLSearchParams(searchParams.toString())
      );
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setYears = useCallback(
    (next: number[]) => {
      const normalized = normalizeHistoricalYears(next);
      setYearsState(normalized);
      syncUrl(normalized);
    },
    [syncUrl]
  );

  const selectAllYears = useCallback(() => {
    setYears(availableYears);
  }, [availableYears, setYears]);

  const selectLastYears = useCallback(
    (n: number) => {
      const sorted = [...availableYears].sort((a, b) => a - b);
      setYears(sorted.slice(-n));
    },
    [availableYears, setYears]
  );

  const resetYears = useCallback(() => {
    const def = normalizeHistoricalYears(
      availableYears.length >= 3
        ? availableYears.slice(-3)
        : availableYears.length > 0
          ? availableYears
          : DEFAULT_HISTORICAL_YEARS
    );
    setYears(def);
  }, [availableYears, setYears]);

  useEffect(() => {
    const fromUrl = parseHistoricalYearsFromSearchParams(searchParams);
    if (fromUrl.length === 0) return;
    const key = stableYearsKey(fromUrl);
    if (key !== yearsKey) setYearsState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  return {
    years,
    yearsKey,
    availableYears,
    mode,
    dimension,
    familyKey,
    displayMode,
    setYears,
    setMode,
    setDimension,
    setFamilyKey,
    setDisplayMode,
    selectAllYears,
    selectLastYears: selectLastYears,
    resetYears,
  };
};
